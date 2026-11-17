import type { Alert, TimelineEvent, User } from '@app/domain';
import { Faker, en } from '@faker-js/faker';
import { buildBackground } from './background.ts';
import { makeCtx, type SeedAttachment } from './context.ts';
import { buildStory } from './story.ts';
import { USERS } from './users.ts';

export interface SeedData {
  users: User[];
  alerts: Alert[];
  timeline: TimelineEvent[];
  attachments: SeedAttachment[];
}

export type { SeedAttachment };

export const BACKGROUND_COUNT = 45;

export function buildSeed(opts: { now: Date; seed: number }): SeedData {
  const ctx = makeCtx(opts.now);
  const faker = new Faker({ locale: [en] });
  faker.seed(opts.seed);

  const story = buildStory(ctx);
  const background = buildBackground(ctx, faker, BACKGROUND_COUNT);

  const alerts = [...story.alerts, ...background.alerts].sort((a, b) => a.id.localeCompare(b.id));
  const timeline = [...story.timeline, ...background.timeline].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
  return {
    users: USERS.map((u) => ({ ...u })),
    alerts,
    timeline,
    attachments: story.attachments,
  };
}
