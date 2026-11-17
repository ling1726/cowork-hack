import { z } from '@hono/zod-openapi';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function errorBody(code: string, message: string, details?: unknown): ErrorBody {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

export const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

/** Response definitions shared by routes: `errorResponses(400, 404)`. */
export function errorResponses<S extends number>(...statuses: S[]) {
  return Object.fromEntries(
    statuses.map((s) => [
      s,
      { description: `Error ${s}`, content: { 'application/json': { schema: ErrorBodySchema } } },
    ]),
  ) as Record<
    S,
    { description: string; content: { 'application/json': { schema: typeof ErrorBodySchema } } }
  >;
}
