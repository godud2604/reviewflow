import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const PAGE_SIZE = 1000;

const toMonthKey = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const directMatch = trimmed.match(/^(\d{4})[-.](\d{1,2})/);
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2].padStart(2, '0')}`;
  }

  const parts = trimmed.split(/[^\d]/).filter(Boolean);
  if (parts.length >= 2 && parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear().toString();
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
};

const parseAdditionalDeadlines = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const months = new Set<string>();
    let offset = 0;

    while (true) {
      const { data, error, count } = await supabase
        .from('schedules')
        .select('visit_date,deadline,additional_deadlines', { count: 'exact' })
        .eq('user_id', userId)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Fetch schedule months error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      (data || []).forEach((row) => {
        const visitMonth = toMonthKey(row.visit_date);
        const deadlineMonth = toMonthKey(row.deadline);
        if (visitMonth) months.add(visitMonth);
        if (deadlineMonth) months.add(deadlineMonth);

        const additionalDeadlines = parseAdditionalDeadlines(row.additional_deadlines);
        additionalDeadlines.forEach((deadline: { date?: string }) => {
          const monthKey = toMonthKey(deadline?.date);
          if (monthKey) months.add(monthKey);
        });
      });

      const totalCount = count ?? 0;
      if (!data?.length || offset + PAGE_SIZE >= totalCount) {
        break;
      }

      offset += PAGE_SIZE;
    }

    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    return NextResponse.json({ months: sortedMonths });
  } catch (error) {
    console.error('Schedule months API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
