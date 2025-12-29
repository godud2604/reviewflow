import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendDailySummaryAlimtalk } from '@/lib/aligo';

type UserProfileSummary = {
  id: string;
  phone_number: string | null;
  phone_verified_at: string | null;
  daily_summary_enabled: boolean | null;
  daily_summary_hour: number | null;
  daily_summary_minute: number | null;
  daily_summary_last_sent_at: string | null;
};

type ScheduleSummary = {
  user_id: string;
  deadline: string | null;
  visit_date: string | null;
  status: string | null;
};

const formatKstDateString = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

const getKstNow = () => {
  const now = new Date();
  const kstString = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  return new Date(kstString);
};

const isSameKstDay = (value: string | null, today: string) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return formatKstDateString(parsed) === today;
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim();
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = tokenMatch?.[1] ?? request.headers.get('x-cron-secret');

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminClient = getSupabaseAdminClient();
    const { data: profiles, error: profileError } = await adminClient
      .from('user_profiles')
      .select(
        'id, phone_number, phone_verified_at, daily_summary_enabled, daily_summary_hour, daily_summary_minute, daily_summary_last_sent_at'
      )
      .eq('daily_summary_enabled', true)
      .not('phone_number', 'is', null)
      .not('phone_verified_at', 'is', null);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const now = getKstNow();
    const today = formatKstDateString(now);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const eligibleProfiles = (profiles ?? []).filter((profile: UserProfileSummary) => {
      const hour = profile.daily_summary_hour ?? 8;
      const minute = profile.daily_summary_minute ?? 0;
      const alreadySent = isSameKstDay(profile.daily_summary_last_sent_at, today);
      return hour === currentHour && minute === currentMinute && !alreadySent;
    });

    if (!eligibleProfiles.length) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const userIds = eligibleProfiles.map((profile) => profile.id);
    const { data: schedules, error: scheduleError } = await adminClient
      .from('schedules')
      .select('user_id, deadline, visit_date, status')
      .in('user_id', userIds)
      .neq('status', '완료');

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    }

    const scheduleMap = new Map<string, ScheduleSummary[]>();
    (schedules ?? []).forEach((schedule) => {
      const items = scheduleMap.get(schedule.user_id) ?? [];
      items.push(schedule);
      scheduleMap.set(schedule.user_id, items);
    });

    let sentCount = 0;
    for (const profile of eligibleProfiles) {
      const phone = profile.phone_number;
      if (!phone) continue;

      const userSchedules = scheduleMap.get(profile.id) ?? [];
      if (userSchedules.length === 0) {
        continue;
      }

      const deadlineToday = userSchedules.filter((s) => s.deadline === today).length;
      const visitToday = userSchedules.filter((s) => s.visit_date === today).length;
      const overdueCount = userSchedules.filter(
        (s) => s.deadline && s.deadline < today
      ).length;

      await sendDailySummaryAlimtalk({
        phone,
        deadlineToday,
        visitToday,
        overdueCount,
      });

      await adminClient
        .from('user_profiles')
        .update({ daily_summary_last_sent_at: new Date().toISOString() })
        .eq('id', profile.id);

      sentCount += 1;
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (error) {
    console.error('알림톡 일일 요약 발송 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알림톡 발송 실패' },
      { status: 500 }
    );
  }
}
