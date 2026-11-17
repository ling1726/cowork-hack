import type { Category, Rule } from '@app/domain';

export const RULES: Record<string, Rule> = {
  'MAR-12-1a': {
    id: 'MAR-12-1a',
    name: 'Layering / spoofing',
    regulation: 'EU MAR Art. 12(2)(c)',
    indicators: [
      { id: 'otr', description: 'Order-to-trade ratio', threshold: '> 20:1' },
      {
        id: 'fast_cancel',
        description: 'Share of orders cancelled within 500 ms of an opposite-side fill',
        threshold: '> 60%',
      },
      {
        id: 'book_imbalance',
        description: 'Resting size on one side as share of displayed depth',
        threshold: '> 80%',
      },
    ],
  },
  'MAR-12-1b': {
    id: 'MAR-12-1b',
    name: 'Wash trades',
    regulation: 'EU MAR Art. 12(1)(a)',
    indicators: [
      {
        id: 'self_match',
        description: 'Share of volume matched against own accounts',
        threshold: '> 15%',
      },
      {
        id: 'net_change',
        description: 'Net beneficial-ownership change over the window',
        threshold: '< 1%',
      },
    ],
  },
  'RL-01': {
    id: 'RL-01',
    name: 'Restricted list breach',
    regulation: 'Firm policy; EU MAR Art. 14',
    indicators: [
      {
        id: 'trade_before_entry',
        description: 'Trade executed before restricted-list entry',
        threshold: 'yes',
      },
      { id: 'deal_team', description: 'Trader is on the deal team', threshold: 'yes' },
    ],
  },
  // Background catalogue. These deliberately differ from the story rules so related-alert
  // matching on `rule` doesn't pull background alerts into the rehearsal stories.
  'MAR-12-1d': {
    id: 'MAR-12-1d',
    name: 'Spoofing: quote stuffing',
    regulation: 'EU MAR Art. 12(2)(c)',
    indicators: [
      { id: 'msg_rate', description: 'Order messages per second', threshold: '> 50' },
      {
        id: 'cancel_ratio',
        description: 'Cancelled share of submitted orders',
        threshold: '> 90%',
      },
    ],
  },
  'MAR-12-1e': {
    id: 'MAR-12-1e',
    name: 'Cross-account wash trades',
    regulation: 'EU MAR Art. 12(1)(a)',
    indicators: [
      {
        id: 'self_match',
        description: 'Share of volume matched across linked accounts',
        threshold: '> 20%',
      },
    ],
  },
  'PL-01': {
    id: 'PL-01',
    name: 'Position limit utilisation',
    regulation: 'MiFID II Art. 57',
    indicators: [
      { id: 'limit_use', description: 'Position as share of limit', threshold: '> 90%' },
    ],
  },
  'BE-01': {
    id: 'BE-01',
    name: 'Best execution slippage',
    regulation: 'MiFID II Art. 27',
    indicators: [
      { id: 'slippage', description: 'Slippage vs arrival price', threshold: '> 15 bps' },
    ],
  },
  'RL-02': {
    id: 'RL-02',
    name: 'Watch list activity',
    regulation: 'Firm policy',
    indicators: [
      { id: 'watch_hit', description: 'Trade in a watch-listed name', threshold: 'yes' },
    ],
  },
  'LR-01': {
    id: 'LR-01',
    name: 'Late trade reporting',
    regulation: 'MiFID II Art. 26',
    indicators: [{ id: 'delay', description: 'Reporting delay', threshold: '> 15 min' }],
  },
  'ID-01': {
    id: 'ID-01',
    name: 'Pre-announcement trading',
    regulation: 'EU MAR Art. 8',
    indicators: [
      { id: 'days_before', description: 'Days between trade and announcement', threshold: '< 5' },
    ],
  },
  'MC-01': {
    id: 'MC-01',
    name: 'Marking the close',
    regulation: 'EU MAR Art. 12(2)(b)',
    indicators: [
      {
        id: 'close_share',
        description: 'Share of volume in the closing auction window',
        threshold: '> 30%',
      },
    ],
  },
};

/** Rule used by generated background alerts for each category. */
export const BACKGROUND_RULE: Record<Category, string> = {
  spoofing_layering: 'MAR-12-1d',
  wash_trade: 'MAR-12-1e',
  position_limit: 'PL-01',
  best_execution: 'BE-01',
  restricted_list: 'RL-02',
  late_reporting: 'LR-01',
  insider_dealing: 'ID-01',
  marking_the_close: 'MC-01',
};

export function rule(id: string): Rule {
  const r = RULES[id];
  if (!r) throw new Error(`unknown rule ${id}`);
  return r;
}
