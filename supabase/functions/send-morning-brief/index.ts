import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ✅ 환경 변수 로드
const ALIGO_APIKEY = Deno.env.get('ALIGO_API_KEY')!;
const ALIGO_USERID = Deno.env.get('ALIGO_USER_ID')!;
const ALIGO_SENDERKEY = Deno.env.get('ALIGO_SENDER_KEY')!;
const ALIGO_SENDER_PHONE = Deno.env.get('ALIGO_SENDER')!;
const SUPABASE_URL = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ✅ GCP 중계 서버 주소 (포트 3000)
const PROXY_URL = 'http://34.45.114.49:3000/send-alimtalk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Supabase Admin 클라이언트
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. 한국 시간(KST) 계산
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);

    // YYYY-MM-DD 형식 문자열
    const todayStr = kstDate.toISOString().split('T')[0];

    const currentHour = kstDate.getUTCHours();
    const currentMinute = kstDate.getUTCMinutes();

    // 30분 단위 근사치 계산
    const targetMinute = currentMinute < 30 ? 0 : 30;

    console.log(`⏰ KST Time: ${todayStr} ${currentHour}:${targetMinute}`);

    // 3. 알림 대상 유저 조회
    const { data: users, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, phone_number, daily_summary_hour, daily_summary_minute, tier')
      .eq('daily_summary_enabled', true)
      .not('phone_number', 'is', null)
      .neq('tier', 'free')
      .eq('daily_summary_hour', currentHour)
      .eq('daily_summary_minute', targetMinute);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users to send.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`👥 Target Users: ${users.length}`);

    // 4. [변경됨] 병렬 처리 (Promise.all) - 100명 동시 발송
    const sendPromises = users.map(async (user) => {
      try {
        const tier = String(user.tier ?? 'free').toLowerCase();
        if (tier === 'free') {
          return null;
        }
        // (1) DB 조회 - 모든 스케줄 가져오기 (완료 여부 무관)
        const { data: allSchedules, error: schedError } = await supabaseAdmin
          .from('schedules')
          .select('id, deadline, additional_deadlines, status, visit_date')
          .eq('user_id', user.id);

        if (schedError) throw schedError;

        const schedules = allSchedules || [];

        const parseAdditionalDeadlines = (value: any) => {
          if (!value) return [];
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('Failed to parse additional_deadlines', e);
            return [];
          }
        };

        // 오늘 마감인 마감일 개수 카운트 (스케줄 개수가 아닌 마감일 개수)
        let dCount = 0;
        // 마감 초과 일정 카운트 (메인 + 추가 마감일, 미완료만)
        let oCount = 0;

        schedules.forEach((schedule) => {
          // 메인 마감일이 오늘이고 미완료인 경우만 카운트
          if (schedule.deadline === todayStr && schedule.status !== '완료') {
            dCount++;
          }

          // 메인 마감일이 오늘 이전이고 미완료인 경우만 카운트
          if (schedule.deadline && schedule.deadline < todayStr && schedule.status !== '완료') {
            oCount++;
          }

          const deadlines = parseAdditionalDeadlines(schedule.additional_deadlines);
          if (deadlines.length) {
            const todayDeadlines = deadlines.filter(
              (d: any) => d.date === todayStr && !d.completed
            );
            dCount += todayDeadlines.length;

            const overdueDeadlines = deadlines.filter(
              (d: any) => d.date && d.date < todayStr && !d.completed
            );
            oCount += overdueDeadlines.length;
          }
        });

        // 오늘 방문 일정 카운트 (완료 여부 무관)
        const vCount = schedules.filter((s) => s.visit_date === todayStr).length;

        // 일정이 없으면 null 리턴 (나중에 필터링)
        if (dCount === 0 && vCount === 0 && oCount === 0) {
          return null;
        }

        // (2) 메시지 구성
        const message = `[오늘의 일정]

좋은 아침이에요!
오늘 예정된 체험단 일정을 정리해서 알려드릴게요.

📌 오늘 마감 일정: ${dCount}건
📍 오늘 방문 일정: ${vCount}건
⏰ 마감 초과 일정: ${oCount}건

오늘 하루도 천천히 화이팅이에요 💛

해당 메시지는 고객님께서 일정 알림 수신에 동의하고 요청하신 경우,
체험단 일정이 있을 때마다 반복적으로 발송됩니다.`;

        // (3) 전송 데이터 구성
        const aligoPayload = {
          apikey: ALIGO_APIKEY,
          userid: ALIGO_USERID,
          senderkey: ALIGO_SENDERKEY,
          sender: ALIGO_SENDER_PHONE,
          tpl_code: 'UE_5312',
          receiver_1: user.phone_number.replace(/[^0-9]/g, ''),
          subject_1: '리뷰플로우_오늘일정',
          message_1: message,
          failover: 'Y',
          fsubject_1: '리뷰플로우 일정 알림',
          fmessage_1: message,
          button_1: JSON.stringify({
            button: [
              {
                name: '일정 한눈에 보기',
                linkType: 'WL',
                linkTypeName: '웹링크',
                linkPc: 'https://reviewflow.tech/',
                linkMo: 'https://reviewflow.tech/',
              },
            ],
          }),
        };

        // (4) 중계 서버 호출
        const aligoRes = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aligoPayload),
        });

        const aligoData = await aligoRes.json();

        return {
          userId: user.id,
          counts: { d: dCount, v: vCount, o: oCount },
          success: aligoData.code == 0,
          msg: aligoData.message,
        };
      } catch (err) {
        console.error(`Failed for user ${user.id}`, err);
        return { userId: user.id, success: false, msg: 'Error' };
      }
    });

    // 🚀 모든 유저에게 동시에 발송하고 결과 기다림
    const resultsRaw = await Promise.all(sendPromises);

    // null(일정 없는 유저) 제거
    const results = resultsRaw.filter((r) => r !== null);

    console.log(`✅ Completed. Sent: ${results.length}`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
