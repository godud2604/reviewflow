import type { ScheduleTransactionItem, TransactionType } from '@/types';

export const DEFAULT_INCOME_LABEL = '현금 수익';
export const DEFAULT_COST_LABEL = '내가 쓴 돈';

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const createIncomeDetailId = () =>
  `detail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const createIncomeDetail = (
  type: TransactionType,
  label = ''
): ScheduleTransactionItem => ({
  id: createIncomeDetailId(),
  label,
  amount: 0,
  type,
  enabled: true,
});

export const parseIncomeDetailsJson = (value?: string | null): ScheduleTransactionItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const type = item.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME';
        const label = typeof item.label === 'string' ? item.label : '';
        return {
          id: typeof item.id === 'string' && item.id.trim() ? item.id : createIncomeDetailId(),
          label,
          amount: Math.max(0, toNumber(item.amount)),
          type,
          enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        };
      });
  } catch {
    return [];
  }
};

export const buildIncomeDetailsFromLegacy = (income: number, cost: number) => {
  const items: ScheduleTransactionItem[] = [];
  if (income > 0) {
    items.push({
      id: createIncomeDetailId(),
      label: DEFAULT_INCOME_LABEL,
      amount: income,
      type: 'INCOME',
      enabled: true,
    });
  }
  if (cost > 0) {
    items.push({
      id: createIncomeDetailId(),
      label: DEFAULT_COST_LABEL,
      amount: cost,
      type: 'EXPENSE',
      enabled: true,
    });
  }
  return items;
};

export const sanitizeIncomeDetails = (items: ScheduleTransactionItem[]) =>
  items
    .map((item) => ({
      ...item,
      label: item.label.trim(),
      amount: Math.max(0, toNumber(item.amount)),
      type: item.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    }))
    .filter((item) => item.label || item.amount > 0 || item.enabled);

export const serializeIncomeDetails = (items: ScheduleTransactionItem[]) => {
  if (!items.length) return null;
  return JSON.stringify(items);
};

export const sumIncomeDetails = (items: ScheduleTransactionItem[]) => {
  const totals = {
    incomeTotal: 0,
    costTotal: 0,
    incomeBreakdown: {} as Record<string, number>,
    costBreakdown: {} as Record<string, number>,
  };

  items.forEach((item) => {
    if (item.enabled === false) return;
    const amount = Math.max(0, toNumber(item.amount));
    const label = item.label.trim();
    const effectiveLabel =
      label || (item.type === 'EXPENSE' ? DEFAULT_COST_LABEL : DEFAULT_INCOME_LABEL);
    if (item.type === 'EXPENSE') {
      totals.costTotal += amount;
      totals.costBreakdown[effectiveLabel] =
        (totals.costBreakdown[effectiveLabel] || 0) + amount;
    } else {
      totals.incomeTotal += amount;
      totals.incomeBreakdown[effectiveLabel] =
        (totals.incomeBreakdown[effectiveLabel] || 0) + amount;
    }
  });

  return totals;
};
