'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase';
import { getRedirectUrl } from '@/lib/getRedirectUrl';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 이미 로그인된 사용자는 홈으로 리다이렉트
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace('/?page=home');
          return;
        }
      } catch (error) {
        console.error('인증 확인 오류:', error);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleKakaoSignIn = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        setError('카카오 로그인에 실패했습니다.');
      }
    } catch (err) {
      setError('카카오 로그인 중 오류가 발생했습니다.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        setError('Apple 로그인에 실패했습니다.');
      }
    } catch (err) {
      setError('Apple 로그인 중 오류가 발생했습니다.');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('이메일 인증을 완료해야 로그인할 수 있어요. 인증 메일을 확인해주세요.');
        } else {
          setError(error.message);
        }
        return;
      }

      router.push('/?page=home');
      router.refresh();
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 확인 중 로딩
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5722]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-3xl px-8 pt-4 pb-8 shadow-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/">
            <img src="/og-image.png" alt="ReviewFlow" className="w-50 mx-auto" />
          </Link>
          <h1 className="text-2xl font-bold text-[#191F28]">로그인</h1>
          <p className="text-[#6B7684] mt-2">체험단 관리를 시작해보세요</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
            {error.includes('이메일 인증을 완료해야 로그인할 수 있어요') && (
              <div className="text-left mt-4 mb-6 p-4 rounded-2xl bg-[#FFF9F4] border border-[#FFDCC2] text-[#62411F] text-sm">
                <strong className="block text-[#FF5722] font-semibold mb-1">
                  이메일 인증을 꼭 완료해주세요
                </strong>
                회원가입 직후 인증 이메일을 전송했습니다. <br />
                <br /> <span className="font-bold text-sm">
                  인증 메일이 보이지 않는다면
                </span> <br /> 1. 스팸함도 확인하시고 링크를 클릭해야 로그인할 수 있어요.
                <br /> 2. 잠시 후 새로고침하거나 메일함을 재확인해주세요.
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#333D4B] mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333D4B] mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF5722] text-white py-3 rounded-xl font-semibold hover:bg-[#E64A19] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <div className="text-right text-sm text-[#6B7684] mt-2">
            <Link href="/forgot-password" className="text-[#FF5722] font-semibold hover:underline">
              비밀번호 찾기
            </Link>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4 text-sm text-[#8B95A1]">또는</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Kakao Login */}
        <button
          type="button"
          onClick={handleKakaoSignIn}
          className="w-full bg-[#FEE500] text-[#000000D9] py-3 rounded-xl font-semibold hover:bg-[#FDD800] transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.636 1.712 4.969 4.326 6.333-.144.522-.926 3.363-.962 3.587 0 0-.019.158.084.218.103.06.224.013.224.013.296-.04 3.432-2.261 3.97-2.645.765.112 1.559.17 2.358.17 5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
          </svg>
          카카오로 시작하기
        </button>

        {/* Apple Login */}
        <button
          type="button"
          onClick={handleAppleSignIn}
          className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition flex items-center justify-center gap-2 cursor-pointer mt-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Apple로 시작하기
        </button>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-[#6B7684]">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-[#FF5722] font-semibold hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
