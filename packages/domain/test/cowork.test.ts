import { describe, expect, it } from 'vitest';
import {
  COWORK_CASE_LABELS,
  COWORK_PROMPT_MAX,
  coworkLink,
  coworkPrompt,
  searchArgs,
  type CoworkCase,
} from '../src/index.ts';

const P = 'Using the alerts tools, ';
const q = (link: string) => decodeURIComponent(link.replace('claude://cowork/new?q=', ''));

describe('coworkPrompt', () => {
  it('investigate', () =>
    expect(coworkPrompt({ kind: 'investigate', alertId: 'ALT-1051' })).toBe(
      `${P}investigate ALT-1051: call get_alert, get_alert_timeline and find_related_alerts, test the evidence against the rule's indicators, and recommend one next action.`,
    ));
  it('second opinion', () =>
    expect(coworkPrompt({ kind: 'second_opinion', alertId: 'ALT-0987' })).toBe(
      `${P}review the closure of ALT-0987: call get_alert and find_related_alerts, quote the closing note, compare it with the related alerts, and say whether it should be reopened.`,
    ));
  it('pattern', () =>
    expect(coworkPrompt({ kind: 'pattern', traderId: 'T-0166', traderName: 'Jonas Weber' })).toBe(
      `${P}check whether trader Jonas Weber (T-0166) has a pattern: call search_alerts with traderId T-0166 (any status) and find_related_alerts for the most recent one, and say how each alert was closed.`,
    ));
  it('triage passes the list filters as search_alerts arguments', () =>
    expect(
      coworkPrompt({
        kind: 'triage',
        search: { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' },
      }),
    ).toBe(
      `${P}triage this list: call search_alerts with {"status":["open"],"severity":["high"],"desk":["eu-equities"],"q":"layering"}, then rank the results and say why.`,
    ));
  it('triage with no filters passes empty arguments', () =>
    expect(coworkPrompt({ kind: 'triage', search: {} })).toBe(
      `${P}triage this list: call search_alerts with {}, then rank the results and say why.`,
    ));
  it('searchArgs drops empty values and page', () =>
    expect(
      searchArgs({ status: [], q: '  ', page: 3, traderId: 'T-0412', sort: '-severity' }),
    ).toEqual({ traderId: 'T-0412', sort: '-severity' }));
  it('explain request', () =>
    expect(
      coworkPrompt({ kind: 'explain_request', requestId: 'AR-0002', alertId: 'ALT-1051' }),
    ).toBe(
      `${P}explain request AR-0002 on ALT-1051: call get_action_request and get_alert, then say what it changes, why you asked for it, and what I should check before approving.`,
    ));
  it('handover', () =>
    expect(coworkPrompt({ kind: 'handover' })).toBe(
      `${P}write my shift handover: call list_users to find me, search_alerts with involvedUserId set to my id and updatedFrom today at 00:00 UTC, then get_alert_timeline for each alert.`,
    ));
  it('no prompt mentions a URL or the skill', () => {
    const cases: CoworkCase[] = [
      { kind: 'investigate', alertId: 'ALT-1' },
      { kind: 'second_opinion', alertId: 'ALT-1' },
      { kind: 'pattern', traderId: 'T-1', traderName: 'X' },
      { kind: 'triage', search: { status: ['open'] } },
      { kind: 'explain_request', requestId: 'AR-1', alertId: 'ALT-1' },
      { kind: 'handover' },
    ];
    for (const c of cases) {
      expect(coworkPrompt(c), c.kind).not.toMatch(/http|skill/);
    }
  });
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
  it('never cuts an emoji in half at the 14,000-character limit', () =>
    expect(q(coworkLink('x'.repeat(COWORK_PROMPT_MAX - 1) + '😀'))).toHaveLength(
      COWORK_PROMPT_MAX - 1,
    ));
  it('returns an empty string for a blank prompt', () => expect(coworkLink('  \n ')).toBe(''));
});
