import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

type MonthlyGrowthRecord = {
  user_id: string;
  econ_value: number | null;
  month_start: string;
};

function buildMonthStart(value?: string) {
  if (!value) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  const match = value.match(/^(\d{4})-(\d{1,2})/);
  if (!match) {
    return null;
  }

  const parsedMonth = Number(match[2]);
  if (parsedMonth < 1 || parsedMonth > 12) {
    return null;
  }

  return `${match[1]}-${String(parsedMonth).padStart(2, '0')}-01`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const monthParam = url.searchParams.get('month');
  const monthStart = buildMonthStart(monthParam);

  if (!userId) {
    return NextResponse.json({ error: 'userId query parameter is required.' }, { status: 400 });
  }

  if (!monthStart) {
    return NextResponse.json({ error: 'month should be in YYYY-MM format.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from<MonthlyGrowthRecord>('monthly_growth')
      .select('user_id, econ_value, month_start')
      .eq('month_start', monthStart)
      .order('econ_value', { ascending: false });

    if (error) {
      console.error('monthly-ranking', error);
      return NextResponse.json({ error: 'Failed to load monthly ranking.' }, { status: 500 });
    }

    const rows = data ?? [];
    const totalUsers = rows.length;
    const topUsers = rows.slice(0, 3).map((row, index) => ({
      userId: row.user_id,
      econValue: Number(row.econ_value ?? 0),
      rank: index + 1,
    }));

    const userIndex = rows.findIndex((row) => row.user_id === userId);
    const userRow = rows[userIndex];
    const hasRecord = Boolean(userRow);
    const rank = hasRecord ? userIndex + 1 : null;
    const userEconValue = hasRecord ? Number(userRow.econ_value ?? 0) : 0;
    const topPercent =
      rank && totalUsers > 0 ? Number(((rank / totalUsers) * 100).toFixed(1)) : null;

    const topOnePercentRank = Math.max(1, Math.ceil(totalUsers * 0.01));
    const topOnePercentRow = rows[topOnePercentRank - 1];
    const topOnePercentValue = topOnePercentRow ? Number(topOnePercentRow.econ_value ?? 0) : 0;
    const amountToTopOnePercent =
      rank && topOnePercentRank >= rank ? 0 : Math.max(0, topOnePercentValue - userEconValue);

    const neighborStart = Math.max(0, (hasRecord ? userIndex : 0) - 2);
    const neighborEnd = Math.min(rows.length, neighborStart + 5);
    const surroundingUsers = rows.slice(neighborStart, neighborEnd).map((row, index) => ({
      userId: row.user_id,
      econValue: Number(row.econ_value ?? 0),
      rank: neighborStart + index + 1,
      isCurrentUser: row.user_id === userId,
    }));

    return NextResponse.json({
      monthStart,
      totalUsers,
      rank,
      econValue: userEconValue,
      topPercent,
      amountToTopOnePercent,
      topOnePercentRank,
      topUsers,
      surroundingUsers,
      hasRecord,
    });
  } catch (error) {
    console.error('monthly-ranking handler failed:', error);
    return NextResponse.json({ error: '서버 오류 발생' }, { status: 500 });
  }
}
