import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const search = (searchParams.get('search') || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!search) {
      return NextResponse.json({
        schedules: [],
        pagination: {
          offset,
          limit,
          total: 0,
          hasMore: false,
        },
        counts: {
          total: 0,
          visit: 0,
          deadline: 0,
          overall: 0,
        },
        platforms: [],
      });
    }

    let query = supabase
      .from('schedules')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .ilike('title', `%${search}%`)
      .order('deadline', { ascending: true, nullsFirst: false });

    query = query.range(offset, offset + limit - 1);

    const { data: schedules, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const { data: allSchedules } = await supabase
      .from('schedules')
      .select('visit_date,deadline,additional_deadlines')
      .eq('user_id', userId)
      .ilike('title', `%${search}%`);

    const { count: overallCount } = await supabase
      .from('schedules')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data: allUserSchedules } = await supabase
      .from('schedules')
      .select('platform')
      .eq('user_id', userId);

    const userPlatforms = Array.from(
      new Set(allUserSchedules?.map((s) => s.platform).filter(Boolean))
    );

    const visitCount = allSchedules?.filter((s) => s.visit_date).length || 0;

    let deadlineCount = 0;
    allSchedules?.forEach((s) => {
      if (s.deadline) deadlineCount++;
      if (s.additional_deadlines) {
        try {
          const additionalDeadlines =
            typeof s.additional_deadlines === 'string'
              ? JSON.parse(s.additional_deadlines)
              : s.additional_deadlines;
          if (Array.isArray(additionalDeadlines)) {
            deadlineCount += additionalDeadlines.filter((d: any) => d.date).length;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    });

    return NextResponse.json({
      schedules: schedules || [],
      pagination: {
        offset,
        limit,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      counts: {
        total: count || 0,
        visit: visitCount,
        deadline: deadlineCount,
        overall: overallCount || 0,
      },
      platforms: userPlatforms || [],
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
