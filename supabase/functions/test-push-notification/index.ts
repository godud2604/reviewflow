import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 요청 본문 파싱
    const { userId, title, body } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 유저(${userId})의 토큰을 찾는 중...`);

    // Supabase Admin 클라이언트 생성
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1️⃣ DB에서 토큰 조회 (profiles 테이블)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('❌ 해당 유저를 찾을 수 없습니다.', profileError);
      return new Response(
        JSON.stringify({ error: '해당 유저를 찾을 수 없거나 토큰이 없습니다.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const pushToken = profileData.expo_push_token;

    if (!pushToken) {
      console.log('❌ 유저는 찾았지만, 푸시 토큰이 비어있습니다.');
      return new Response(JSON.stringify({ error: '푸시 토큰이 등록되지 않았습니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ 토큰 발견! 알림 발송 시도: ${pushToken.substring(0, 20)}...`);

    // 2️⃣ Expo 서버로 푸시 알림 전송
    const message = {
      to: pushToken,
      sound: 'default',
      title: title || '리뷰플로우 알림 도착! 🍊',
      body: body || 'Supabase Edge Function에서 보낸 테스트 알림입니다.',
      data: {
        testData: 'from supabase edge function',
        timestamp: new Date().toISOString(),
      },
    };

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const expoData = await expoResponse.json();

    if (expoResponse.status === 200) {
      console.log(`🚀 [성공] 알림이 전송되었습니다! (ID: ${userId})`);
      console.log('응답:', expoData);

      return new Response(
        JSON.stringify({
          success: true,
          message: '알림이 성공적으로 전송되었습니다.',
          userId,
          pushToken: pushToken.substring(0, 20) + '...',
          expoResponse: expoData,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      console.error(`💥 [실패] 전송 실패:`, expoData);
      return new Response(
        JSON.stringify({
          error: 'Expo 푸시 알림 전송 실패',
          details: expoData,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
