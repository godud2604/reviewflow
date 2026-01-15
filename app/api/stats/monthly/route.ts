import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import type { DbSchedule, DbExtraIncome } from '@/types/database';
import type { MonthlyGrowth } from '@/types';

const monthRegex = /^\d{4}-\d{2}$/;
const monthlyGrowthCache = new Map<
  string,
  { cachedAt: number; monthlyGrowth: MonthlyGrowth[]; availableMonths: string[] }
>();
const MONTHLY_GROWTH_TTL_MS = 5 * 60 * 1000;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const buildMonthParam = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

type MonthlyGrowthInternal = MonthlyGrowth & { itemCount: number };

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const monthParam = searchParams.get('month') || buildMonthParam();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!monthRegex.test(monthParam)) {
      return NextResponse.json({ error: 'month should be in YYYY-MM format.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const scheduleQuery = supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .or(
        `deadline.ilike.${monthParam}%,visit_date.ilike.${monthParam}%,additional_deadlines.cs.[{"date":"${monthParam}-01"}]`
      );

    const extraIncomeQuery = supabase
      .from('extra_incomes')
      .select('*')
      .eq('user_id', userId)
      .ilike('date', `${monthParam}%`);

    const cachedGrowth = monthlyGrowthCache.get(userId);
    const now = Date.now();
    const shouldRefreshGrowth =
      !cachedGrowth || now - cachedGrowth.cachedAt > MONTHLY_GROWTH_TTL_MS;

    const growthSchedulesQuery = shouldRefreshGrowth
      ? supabase
          .from('schedules')
          .select('visit_date,deadline,benefit,income,cost')
          .eq('user_id', userId)
      : null;

    const growthExtraQuery = shouldRefreshGrowth
      ? supabase.from('extra_incomes').select('date,amount').eq('user_id', userId)
      : null;

    const [schedulesResult, extraIncomeResult, growthSchedulesResult, growthExtraResult] =
      await Promise.all([
        scheduleQuery,
        extraIncomeQuery,
        growthSchedulesQuery,
        growthExtraQuery,
      ]);

    const schedulesError = schedulesResult?.error;
    const extraIncomeError = extraIncomeResult?.error;
    const allSchedulesError = growthSchedulesResult?.error;
    const allExtraIncomesError = growthExtraResult?.error;

    if (schedulesError) {
      console.error('stats-monthly schedules error:', schedulesError);
      return NextResponse.json({ error: schedulesError.message }, { status: 500 });
    }

    if (extraIncomeError) {
      console.error('stats-monthly extra incomes error:', extraIncomeError);
      return NextResponse.json({ error: extraIncomeError.message }, { status: 500 });
    }

    if (allSchedulesError) {
      console.error('stats-monthly growth schedules error:', allSchedulesError);
      return NextResponse.json({ error: allSchedulesError.message }, { status: 500 });
    }

    if (allExtraIncomesError) {
      console.error('stats-monthly growth extra incomes error:', allExtraIncomesError);
      return NextResponse.json({ error: allExtraIncomesError.message }, { status: 500 });
    }

    const schedules = schedulesResult?.data || [];
    const extraIncomes = extraIncomeResult?.data || [];
    const allSchedules = growthSchedulesResult?.data || [];
    const allExtraIncomes = growthExtraResult?.data || [];

    const monthMap = new Map<string, MonthlyGrowthInternal>();

    const matchesSelectedMonth = (schedule: DbSchedule) => {
      const visit = schedule.visit_date || '';
      const deadline = schedule.deadline || '';
      const effective = visit || deadline;
      if (!effective) return false;
      return effective.startsWith(monthParam);
    };

    const filteredSchedules = (schedules || []).filter(matchesSelectedMonth);

    const ensureEntry = (key: string) => {
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          monthStart: key,
          benefitTotal: 0,
          incomeTotal: 0,
          costTotal: 0,
          extraIncomeTotal: 0,
          econValue: 0,
          itemCount: 0,
        });
      }
      return monthMap.get(key)!;
    };

    let monthlyGrowth = cachedGrowth?.monthlyGrowth || [];
    let availableMonths = cachedGrowth?.availableMonths || [];

    if (shouldRefreshGrowth) {
      allSchedules.forEach((schedule) => {
        const date = parseDate(schedule.visit_date) || parseDate(schedule.deadline);
        if (!date) return;
        const key = toMonthKey(date);
        const entry = ensureEntry(key);
        entry.benefitTotal += toNumber(schedule.benefit);
        entry.incomeTotal += toNumber(schedule.income);
        entry.costTotal += toNumber(schedule.cost);
        entry.itemCount += 1;
      });

      allExtraIncomes.forEach((income) => {
        const date = parseDate(income.date);
        if (!date) return;
        const key = toMonthKey(date);
        const entry = ensureEntry(key);
        entry.extraIncomeTotal += toNumber(income.amount);
        entry.itemCount += 1;
      });

      const growthWithCounts = Array.from(monthMap.values())
        .map((entry) => ({
          monthStart: entry.monthStart,
          benefitTotal: entry.benefitTotal,
          incomeTotal: entry.incomeTotal,
          costTotal: entry.costTotal,
          extraIncomeTotal: entry.extraIncomeTotal,
          econValue:
            entry.benefitTotal + entry.incomeTotal + entry.extraIncomeTotal - entry.costTotal,
          itemCount: entry.itemCount,
        }))
        .sort((a, b) => new Date(a.monthStart).getTime() - new Date(b.monthStart).getTime());

      monthlyGrowth = growthWithCounts.map(({ itemCount, ...rest }) => rest);
      availableMonths = growthWithCounts
        .filter((entry) => entry.itemCount > 0)
        .map((entry) => entry.monthStart);

      monthlyGrowthCache.set(userId, {
        cachedAt: now,
        monthlyGrowth,
        availableMonths,
      });
    }

    return NextResponse.json({
      monthStart: `${monthParam}-01`,
      schedules: filteredSchedules as DbSchedule[],
      extraIncomes: (extraIncomes || []) as DbExtraIncome[],
      monthlyGrowth,
      availableMonths,
    });
  } catch (error) {
    console.error('stats-monthly handler failed:', error);
    return NextResponse.json({ error: 'Failed to load monthly stats.' }, { status: 500 });
  }
}
