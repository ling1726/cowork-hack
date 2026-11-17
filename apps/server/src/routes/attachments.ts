import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { forbidAgent, requireUser, type Env } from '../context.ts';
import { ApiError, errorResponses } from '../errors.ts';
import { applyCommand } from '../services/commands.ts';
import { WriteResultSchema } from './alerts-write.ts';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const upload = createRoute({
  method: 'post',
  path: '/api/alerts/{id}/attachments',
  summary: 'Upload an attachment (max 5 MB)',
  tags: ['alerts'],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'The updated alert and the timeline event it produced',
      content: { 'application/json': { schema: WriteResultSchema } },
    },
    ...errorResponses(400, 403, 404, 413),
  },
});

const download = createRoute({
  method: 'get',
  path: '/api/attachments/{id}/content',
  summary: 'Download attachment bytes',
  tags: ['alerts'],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'The stored bytes',
      content: {
        'application/octet-stream': {
          schema: z.string().openapi({ type: 'string', format: 'binary' }),
        },
      },
    },
    ...errorResponses(404),
  },
});

const asciiName = (name: string) => name.replace(/[^\x20-\x7e]|["\\]/g, '_');

export function registerAttachments(app: OpenAPIHono<Env>): void {
  app.openapi(upload, async (c) => {
    forbidAgent(c);
    const userId = requireUser(c);
    const { file } = c.req.valid('form');
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(413, 'too_large', 'Attachments are limited to 5 MB');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = applyCommand(
      c.get('store'),
      c.req.valid('param').id,
      {
        kind: 'add_attachment',
        filename: file.name || 'attachment',
        mimeType: file.type || 'application/octet-stream',
        bytes,
      },
      { userId, via: 'app' },
    );
    return c.json(result, 200);
  });

  app.openapi(download, (c) => {
    const { id } = c.req.valid('param');
    const stored = c.get('store').attachments.get(id);
    if (!stored) throw new ApiError(404, 'not_found', `Attachment ${id} not found`);
    const { filename, mimeType } = stored.meta;
    return new Response(stored.bytes, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stored.bytes.length),
        'Content-Disposition': `attachment; filename="${asciiName(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    }) as never;
  });
}
