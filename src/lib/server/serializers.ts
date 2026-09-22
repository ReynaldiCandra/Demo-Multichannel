import type { MetaAdTest } from '@/lib/db';

export function serializeMetaAdTest(test: MetaAdTest) {
  return {
    id: test.id,
    productName: test.productName,
    startDate: test.startDate,
    endDate: test.endDate,
    status: test.status,
    totalSpend: test.totalSpend,
    totalLeads: test.totalLeads,
    totalClosing: test.totalClosing,
    totalRevenue: test.totalRevenue,
    costPerLead: test.totalLeads ? Math.round(test.totalSpend / test.totalLeads) : null,
    costPerClosing: test.totalClosing
      ? Math.round(test.totalSpend / test.totalClosing)
      : null,
    notes: test.notes,
    lastUpdated: test.lastUpdated,
  };
}
