import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const metaCache = (globalThis as typeof globalThis & {
      __schedulesMetaCache?: Map<
        string,
        {
          cachedAt: number;
          counts: { total: number; visit: number; deadline: number; overall: number };
          platforms: string[];
        }
      >;
    }).__schedulesMetaCache;
    const schedulesMetaCache =
      metaCache ||
      ((globalThis as typeof globalThis & {
        __schedulesMetaCache?: Map<
          string,
          {
            cachedAt: number;
            counts: { total: number; visit: number; deadline: number; overall: number };
            platforms: string[];
          }
        >;
      }).__schedulesMetaCache = new Map());
    const META_TTL_MS = 3 * 60 * 1000;

    // Query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const refreshParam = searchParams.get('refresh');
    const forceRefresh =
      refreshParam === '1' || refreshParam === 'true' || refreshParam === 'yes';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const selectedDate = searchParams.get('selectedDate');
    const month = searchParams.get('month'); // YYYY-MM
    const includeMeta = searchParams.get('meta') !== '0';
    const platforms = searchParams.get('platforms')?.split(',').filter(Boolean) || [];
    const statuses = searchParams.get('statuses')?.split(',').filter(Boolean) || [];
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const reviewTypes = searchParams.get('reviewTypes')?.split(',').filter(Boolean) || [];
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'deadline-asc';
    const paybackOnly = searchParams.get('paybackOnly') === 'true';

    const includeCompleted = Boolean(selectedDate);

    // Base query
    let query = supabase
      .from('schedules')
      .select('*', includeMeta ? { count: 'exact' } : undefined)
      .eq('user_id', userId);

    if (!includeCompleted) {
      query = query.neq('status', '완료');
    }

    const shouldFilterMonthInMemory = Boolean(month) && !includeMeta && !selectedDate;

    // 월별 필터
    if (month && !shouldFilterMonthInMemory) {
      // month (e.g., '2026-01')
      const [yearStr, monthStr] = month.split('-');
      const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
      const additionalDeadlineFilters = Array.from({ length: daysInMonth }, (_, idx) => {
        const day = String(idx + 1).padStart(2, '0');
        return `additional_deadlines.cs.[{"date":"${month}-${day}"}]`;
      });
      const monthFilters = [
        `deadline.ilike.${month}%`,
        `visit_date.ilike.${month}%`,
        ...additionalDeadlineFilters,
      ];
      query = query.or(monthFilters.join(','));
    }

    // 날짜 필터 (selectedDate takes precedence or acts as additional filter? Usually mutually exclusive in UI but let's handle overlapping)
    if (selectedDate) {
      query = query.or(
        `deadline.eq.${selectedDate},visit_date.eq.${selectedDate},additional_deadlines.cs.[{"date":"${selectedDate}"}]`
      );
    }

    // 플랫폼 필터
    if (platforms.length > 0) {
      query = query.in('platform', platforms);
    }

    // 상태 필터
    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    // 카테고리 필터
    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    // 콘텐츠 종류 필터
    if (reviewTypes.length > 0) {
      query = query.in('review_type', reviewTypes);
    }

    // 페이백 필터
    if (paybackOnly) {
      query = query.eq('payback_expected', true);
    }

    // 검색 필터
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // 정렬
    switch (sortBy) {
      case 'deadline-asc':
        query = query.order('deadline', { ascending: true, nullsFirst: false });
        break;
      case 'deadline-desc':
        query = query.order('deadline', { ascending: false, nullsFirst: false });
        break;
      case 'visit-asc':
        query = query.neq('visit_date', '').not('visit_date', 'is', null);
        query = query.order('visit_date', { ascending: true, nullsFirst: false });
        break;
      case 'visit-desc':
        query = query.neq('visit_date', '').not('visit_date', 'is', null);
        query = query.order('visit_date', { ascending: false, nullsFirst: false });
        break;
      case 'amount-asc':
        query = query.order('benefit', { ascending: true });
        break;
      case 'amount-desc':
        query = query.order('benefit', { ascending: false });
        break;
      case 'title':
        query = query.order('title', { ascending: true });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data: schedules, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const sortedSchedules = selectedDate
      ? (schedules || []).slice().sort((a, b) => {
          const aCompleted = a.status === '완료';
          const bCompleted = b.status === '완료';
          if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

          if (!aCompleted) {
            const aVisit = a.visit_date || '';
            const bVisit = b.visit_date || '';
            if (aVisit && bVisit) return aVisit.localeCompare(bVisit);
            if (aVisit) return -1;
            if (bVisit) return 1;
          }

          return 0;
        })
      : schedules || [];

    const monthPrefix = month ? `${month}-` : '';
    const monthFilteredSchedules = shouldFilterMonthInMemory
      ? sortedSchedules.filter((schedule) => {
          const hasDeadline = schedule.deadline?.startsWith(monthPrefix);
          const hasVisit = schedule.visit_date?.startsWith(monthPrefix);
          if (hasDeadline || hasVisit) return true;
          if (!schedule.additional_deadlines) return false;
          try {
            const additionalDeadlines =
              typeof schedule.additional_deadlines === 'string'
                ? JSON.parse(schedule.additional_deadlines)
                : schedule.additional_deadlines;
            if (!Array.isArray(additionalDeadlines)) return false;
            return additionalDeadlines.some((deadline: { date?: string }) =>
              deadline?.date?.startsWith(monthPrefix)
            );
          } catch (e) {
            return false;
          }
        })
      : sortedSchedules;

    if (!includeMeta) {
      return NextResponse.json({
        schedules: monthFilteredSchedules,
        pagination: {
          offset,
          limit,
          total: monthFilteredSchedules.length,
          hasMore: false,
        },
      });
    }

    const metaCacheKey = JSON.stringify({
      userId,
      selectedDate,
      month,
      platforms,
      statuses,
      categories,
      reviewTypes,
      search,
      paybackOnly,
    });

    const cachedMeta = schedulesMetaCache.get(metaCacheKey);
    const now = Date.now();
    const canUseCache =
      !forceRefresh && cachedMeta && now - cachedMeta.cachedAt < META_TTL_MS;

    if (canUseCache) {
      return NextResponse.json({
        schedules: sortedSchedules,
        pagination: {
          offset,
          limit,
          total: count || 0,
          hasMore: offset + limit < (count || 0),
        },
        counts: cachedMeta.counts,
        platforms: cachedMeta.platforms,
      });
    }

    // 카운트 계산을 위한 별도 쿼리 (필터링 적용된 전체 데이터)
    let countQuery = supabase
      .from('schedules')
      .select('visit_date,deadline,additional_deadlines', { count: 'exact' })
      .eq('user_id', userId);

    if (!includeCompleted) {
      countQuery = countQuery.neq('status', '완료');
    }

    // 동일한 필터 적용
    if (selectedDate) {
      countQuery = countQuery.or(
        `deadline.eq.${selectedDate},visit_date.eq.${selectedDate},additional_deadlines.cs.[{"date":"${selectedDate}"}]`
      );
    }
    if (paybackOnly) countQuery = countQuery.eq('payback_expected', true);

    if (platforms.length > 0) countQuery = countQuery.in('platform', platforms);
    if (statuses.length > 0) countQuery = countQuery.in('status', statuses);
    if (categories.length > 0) countQuery = countQuery.in('category', categories);
    if (reviewTypes.length > 0) countQuery = countQuery.in('review_type', reviewTypes);
    if (search) countQuery = countQuery.ilike('title', `%${search}%`);

    const [countResult, overallResult, platformsResult] = await Promise.all([
      countQuery,
      supabase
        .from('schedules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase.from('schedules').select('platform').eq('user_id', userId),
    ]);

    const { data: allSchedules, count: totalCount } = countResult;
    const { count: overallCount } = overallResult;
    const { data: allUserSchedules } = platformsResult;

    const userPlatforms = Array.from(
      new Set(allUserSchedules?.map((s) => s.platform).filter(Boolean))
    );

    // 방문일 카운트 (선택된 날짜가 있으면 해당 날짜 방문만 집계)
    const visitCount = selectedDate
      ? allSchedules?.filter((s) => s.visit_date === selectedDate).length || 0
      : allSchedules?.filter((s) => s.visit_date).length || 0;

    // 마감일 카운트 (메인 마감일 + 추가 마감일)
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

    const response = {
      schedules: sortedSchedules,
      pagination: {
        offset,
        limit,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      counts: {
        total: totalCount || 0,
        visit: visitCount,
        deadline: deadlineCount,
        overall: overallCount || 0,
      },
      platforms: userPlatforms || [],
    };

    schedulesMetaCache.set(metaCacheKey, {
      cachedAt: now,
      counts: response.counts,
      platforms: response.platforms,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
