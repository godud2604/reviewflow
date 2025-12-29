import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    // 1. 클라이언트(Curl/앱)에서 보낸 데이터 받기
    // 보낼 때: {"phone": "010...", "message": "..."}
    const { phone, message } = await req.json();

    // 2. GCP VM 서버 설정 (★여기를 꼭 수정하세요★)
    // 예: const GCP_IP = "34.64.xxx.xxx";
    const GCP_IP = '34.45.114.49';
    const GCP_PORT = '3000';
    const GCP_URL = `http://${GCP_IP}:${GCP_PORT}/send-sms`;

    console.log(`[Supabase] GCP 서버(${GCP_URL})로 전송 시도 중...`);

    // 3. GCP Express 서버가 원하는 변수명으로 변환
    // GCP 코드: req.body.receiver, req.body.msg 를 기다리고 있음
    const payload = {
      receiver: phone, // phone -> receiver
      msg: message, // message -> msg
      testmode_yn: 'N', // 테스트 모드 (실전송하려면 "N"으로 변경)
    };

    // 4. GCP로 요청 쏘기 (Fetch)
    const gcpResponse = await fetch(GCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 5. GCP 응답 받아서 클라이언트에게 그대로 전달
    // GCP가 404나 500을 줘도 에러 내용을 보기 위해 text로 먼저 받음
    const responseText = await gcpResponse.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText); // JSON이면 파싱
    } catch {
      responseData = { message: responseText }; // 일반 텍스트면 그대로
    }

    if (!gcpResponse.ok) {
      throw new Error(`GCP Error(${gcpResponse.status}): ${responseText}`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[Supabase Error]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
