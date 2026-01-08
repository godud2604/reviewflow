'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js'; // ⚠️ 본인의 supabase client 경로로 수정!

export default function TokenListener() {
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 💾 Supabase 저장 함수
    const saveTokenToSupabase = async (token: string) => {
      try {
        // 1. 현재 로그인한 유저 확인
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.log('로그인 상태가 아니라서 토큰 저장을 건너뜁니다.');
          return;
        }

        // 2. profiles 테이블에 토큰 업데이트 (Upsert)
        const { error } = await supabase
          .from('user_profiles') // ⚠️ 테이블 이름 확인 (users 또는 profiles)
          .upsert({
            id: user.id,
            expo_push_token: token,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('❌ Supabase 저장 실패:', error);
        } else {
          console.log('✅ Supabase 저장 성공!');
        }
      } catch (e) {
        console.error('저장 중 오류 발생:', e);
      }
    };

    // 📩 앱에서 보낸 메시지를 받는 함수
    const handleMessage = async (event: any) => {
      try {
        // 1. 데이터 파싱 (앱에서 JSON.stringify로 보냈으므로 파싱 필요)
        // (보안을 위해 event.data가 문자열인지 확인)
        if (typeof event.data !== 'string') return;

        const data = JSON.parse(event.data);

        // 2. 메시지 타입 확인 ('PUSH_TOKEN' 인지?)
        if (data.type === 'PUSH_TOKEN' && data.token) {
          console.log('📲 앱에서 토큰 받음:', data.token);

          // 3. Supabase에 저장하기
          await saveTokenToSupabase(data.token);
        }
      } catch (error) {
        // JSON 형식이 아닌 메시지는 무시
        // console.error("메시지 파싱 에러:", error);
      }
    };

    // 🎧 리스너 등록 (Android/iOS 호환성을 위해 window와 document 둘 다 등록)
    if ((window as any).ReactNativeWebView) {
      // 앱 환경인지 체크 (선택사항)
    }

    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage); // 안드로이드 일부 버전 대응

    // 컴포넌트 언마운트 시 리스너 제거 (청소)
    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage);
    };
  }, []);

  return null; // 이 컴포넌트는 화면에 아무것도 그리지 않습니다.
}
