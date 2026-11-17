import createClient from 'openapi-fetch';
import type { components, paths } from './schema.d.ts';

export type { components, paths };

export interface ApiClientOptions {
  /** Origin of the API, e.g. `http://localhost:3001`. Empty string for same-origin (the web app). */
  baseUrl: string;
  /** Called per request; the value becomes `X-User-Id`. */
  getUserId?: () => string | undefined;
  /** When set, requests carry `Authorization: Bearer <token>` and the backend treats them as Claude. */
  agentToken?: string;
  fetch?: (request: Request) => Promise<Response>;
}

export function createApiClient(opts: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl,
    querySerializer: { array: { style: 'form', explode: false } },
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  client.use({
    onRequest({ request }) {
      const userId = opts.getUserId?.();
      if (userId) request.headers.set('X-User-Id', userId);
      if (opts.agentToken) request.headers.set('Authorization', `Bearer ${opts.agentToken}`);
      return request;
    },
  });
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface ErrorShape {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Returns `data`, or throws an `ApiRequestError` built from the backend's error body. */
export function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.error !== undefined || r.data === undefined) {
    const e = (r.error as ErrorShape | undefined)?.error;
    throw new ApiRequestError(
      r.response.status,
      e?.code ?? 'http_error',
      e?.message ?? `Request failed with status ${r.response.status}`,
      e?.details,
    );
  }
  return r.data;
}
