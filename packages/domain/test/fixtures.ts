export function fixtureAlert() {
  return {
    id: 'ALT-1042',
    title: 'Possible layering in SAP GY by T-0412',
    summary:
      'Repeated large orders on one side cancelled within milliseconds of opposite-side fills.',
    description: 'Pattern consistent with **layering** across the SAP GY book.',
    status: 'open',
    severity: 'high',
    category: 'spoofing_layering',
    rule: {
      id: 'MAR-12-1a',
      name: 'Layering / spoofing',
      regulation: 'EU MAR Art. 12(2)(c)',
      indicators: [
        { id: 'otr', description: 'Order-to-trade ratio', threshold: '> 20:1' },
        { id: 'fast_cancel', description: 'Fast cancels', threshold: '> 60%' },
      ],
    },
    desk: 'eu-equities',
    trader: { id: 'T-0412', name: 'James Whitfield' },
    instrument: { symbol: 'SAP GY', name: 'SAP SE', assetClass: 'equity' },
    assignees: { primaryId: 'U-01', backupId: 'U-03', escalatedTo: [] },
    highlights: [
      { label: 'Order-to-trade ratio', value: '34:1', tone: 'danger' },
      { label: 'Notional', value: '€18.4m' },
    ],
    dataTabs: [
      {
        id: 'orders',
        title: 'Orders',
        columns: [
          { key: 'time', label: 'Time', type: 'datetime' },
          { key: 'qty', label: 'Qty', type: 'number' },
        ],
        rows: [{ time: '2026-11-17T07:00:00.000Z', qty: 1000 }],
      },
    ],
    links: [
      {
        id: 'LNK-0001',
        title: 'Surveillance runbook',
        url: 'https://example.com/runbook',
        addedBy: 'U-01',
        addedAt: '2026-11-17T07:10:00.000Z',
      },
    ],
    attachments: [
      {
        id: 'ATT-0001',
        filename: 'order-blotter.csv',
        mimeType: 'text/csv',
        sizeBytes: 1234,
        uploadedBy: 'U-01',
        uploadedAt: '2026-11-17T07:15:00.000Z',
      },
    ],
    createdAt: '2026-11-17T07:00:00.000Z',
    updatedAt: '2026-11-17T07:00:00.000Z',
  };
}
