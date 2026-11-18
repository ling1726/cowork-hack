import { describe, expect, it } from 'vitest';
import { COWORK_CASE_LABELS, COWORK_PROMPT_MAX, coworkLink, coworkPrompt } from '../src/index.ts';

const P = 'Using the alerts connector and the investigate-alert skill, ';
const q = (link: string) => decodeURIComponent(link.replace('claude://cowork/new?q=', ''));

describe('coworkPrompt', () => {
  it('investigate', () =>
    expect(coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' })).toBe(
      `${P}investigate ALT-1051. Test the evidence against the rule and recommend one next action.`,
    ));
  it('second opinion', () =>
    expect(coworkPrompt({ kind: 'second_opinion', alertId: 'ALT-0987' })).toBe(
      `${P}review the closure of ALT-0987. Quote the closing note, compare it with related alerts, and say whether it should be reopened.`,
    ));
  it('pattern', () =>
    expect(coworkPrompt({ kind: 'pattern', traderId: 'T-0166', traderName: 'Jonas Weber' })).toBe(
      `${P}check whether trader Jonas Weber (T-0166) has a pattern across alerts, any status, and how each was closed.`,
    ));
  it('triage embeds the same list URL the app builds', () =>
    expect(
      coworkPrompt({
        kind: 'triage',
        base: 'http://localhost:5173',
        search: { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' },
      }),
    ).toBe(
      `${P}triage the alerts at http://localhost:5173/alerts?status=open&severity=high&desk=eu-equities&q=layering: search with the same filters and rank them.`,
    ));
  it('explain request', () =>
    expect(
      coworkPrompt({ kind: 'explain_request', requestId: 'AR-0002', alertId: 'ALT-1051' }),
    ).toBe(
      `${P}explain request AR-0002 on ALT-1051: what it changes, why you asked for it, and what I should check before approving.`,
    ));
  it('handover', () =>
    expect(coworkPrompt({ kind: 'handover' })).toBe(`${P}write my shift handover.`));
  it('has a label for every kind', () =>
    expect(Object.keys(COWORK_CASE_LABELS).sort()).toEqual([
      'explain_request',
      'handover',
      'investigate',
      'pattern',
      'second_opinion',
      'triage',
    ]));
});

describe('coworkLink', () => {
  it('uses the Cowork scheme and nothing else', () =>
    expect(coworkLink('hi there')).toBe('claude://cowork/new?q=hi%20there'));
  it('round-trips awkward text exactly', () => {
    const text = `a&b=c #x ?y 100% "q" 'z' é ü 日本 \nnext`;
    expect(q(coworkLink(text))).toBe(text);
  });
  it('caps the prompt at 14,000 characters before encoding', () =>
    expect(q(coworkLink('x'.repeat(COWORK_PROMPT_MAX + 500)))).toHaveLength(COWORK_PROMPT_MAX));
  it('returns an empty string for a blank prompt', () => expect(coworkLink('  \n ')).toBe(''));
});
