import { createHash, timingSafeEqual } from 'node:crypto';
import type { Via } from '@app/domain';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Store } from './store/store.ts';
import { ApiError } from './errors.ts';

export interface RequestCtx {
  userId?: string;
  via: Via;
  isAgent: boolean;
}

export type Env = { Variables: { ctx: RequestCtx; store: Store } };

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time comparison (digests have equal length, so the lengths never leak). */
function tokenMatches(provided: string, expected: string): boolean {
  return timingSafeEqual(sha256(provided), sha256(expected));
}

/**
 * Builds the request context. Agent origin is detected only from a valid
 * `Authorization: Bearer <AGENT_TOKEN>`; no other header can claim or hide it.
 */
export function contextMiddleware(store: Store, agentToken: string) {
  return createMiddleware<Env>(async (c, next) => {
    const match = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '');
    const isAgent = match?.[1] !== undefined && tokenMatches(match[1], agentToken);
    const userId = c.req.header('X-User-Id') || undefined;
    c.set('store', store);
    c.set('ctx', { ...(userId ? { userId } : {}), via: isAgent ? 'claude' : 'app', isAgent });
    await next();
  });
}

export function requireUser(c: Context<Env, any, any>): string {
  const { userId } = c.get('ctx');
  if (!userId) throw new ApiError(400, 'missing_user', 'The X-User-Id header is required');
  if (!c.get('store').users.has(userId)) {
    throw new ApiError(400, 'unknown_user', `Unknown user ${userId}`);
  }
  return userId;
}

export function forbidAgent(c: Context<Env, any, any>): void {
  if (c.get('ctx').isAgent) {
    throw new ApiError(403, 'agent_forbidden', 'This action is not available to Claude');
  }
}
