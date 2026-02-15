import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAiQuotaStatus } from '@/lib/ai-quota';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('last_guideline_analysis_at, guideline_daily_count, guideline_daily_count_date, last_blog_draft_generated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: '사용자 정보를 조회할 수 없습니다.' }, { status: 400 });
    }

    const quota = getAiQuotaStatus({
      lastGuidelineAnalysisAt: data?.last_guideline_analysis_at ?? null,
      guidelineDailyCount: data?.guideline_daily_count ?? 0,
      guidelineDailyCountDate: data?.guideline_daily_count_date ?? null,
      lastBlogDraftGeneratedAt: data?.last_blog_draft_generated_at ?? null,
    });

    return NextResponse.json({
      success: true,
      data: quota,
    });
  } catch (error) {
    console.error('AI quota-status 오류:', error);
    return NextResponse.json({ error: '쿼터 상태 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
