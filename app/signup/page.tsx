'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase';
import { getRedirectUrl } from '@/lib/getRedirectUrl';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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

  const handleKakaoSignUp = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        setError('카카오 회원가입에 실패했습니다.');
      }
    } catch (err) {
      setError('카카오 회원가입 중 오류가 발생했습니다.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 길이 확인
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError('이미 가입된 이메일입니다.');
        } else if (error.message.includes('Password')) {
          setError('비밀번호가 보안 요구사항을 충족하지 않습니다.');
        } else {
          setError(error.message);
        }
        return;
      }

      // Supabase는 이미 가입된 이메일의 경우 user.identities가 빈 배열로 반환됨
      if (data?.user?.identities?.length === 0) {
        setError('이미 가입된 이메일입니다. 로그인을 시도해주세요.');
        return;
      }

      setSuccess(true);

      // Fire-and-forget: signup notification (server-side counts + Google Chat webhook)
      void fetch('/api/hooks/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data?.user?.id, provider: 'email' }),
      }).catch(() => {});
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.');
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

  if (success) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white rounded-3xl p-8 shadow-lg text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#191F28] mb-2">이메일 인증을 꼭 해주세요!</h2>
          <div className="text-left mt-4 mb-6 p-4 rounded-2xl bg-[#FFF9F4] border border-[#FFDCC2] text-[#62411F] text-sm">
            <strong className="block text-[#FF5722] font-semibold mb-1">
              이메일 인증을 꼭 완료해주세요
            </strong>
            회원가입 직후 인증 이메일을 전송했습니다. <br />
            <br /> <span className="font-bold text-sm">
              인증 메일이 보이지 않는다면
            </span> <br /> 1. 스팸함도 확인하시고 링크를 클릭해야 로그인할 수 있어요.
            <br /> 2. 잠시 후 새로고침하거나 메일함을 재확인해주세요.
            <br /> 3. 이메일이 발송이 안됐을 경우 admin@reviewflow.kr로 문의주세요.
          </div>
          <Link
            href="/signin"
            className="inline-block bg-[#FF5722] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#E64A19] transition"
          >
            로그인 페이지로
          </Link>
        </div>
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
          <h1 className="text-2xl font-bold text-[#191F28]">회원가입</h1>
          <p className="text-[#6B7684] mt-2">무료로 시작하세요</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignUp} className="space-y-4">
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
              placeholder="6자 이상 입력하세요"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333D4B] mb-2">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF5722] text-white py-3 rounded-xl font-semibold hover:bg-[#E64A19] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4 text-sm text-[#8B95A1]">또는</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        {/* Kakao Sign Up */}
        <button
          type="button"
          onClick={handleKakaoSignUp}
          className="w-full bg-[#FEE500] text-[#000000D9] py-3 rounded-xl font-semibold hover:bg-[#FDD800] transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.636 1.712 4.969 4.326 6.333-.144.522-.926 3.363-.962 3.587 0 0-.019.158.084.218.103.06.224.013.224.013.296-.04 3.432-2.261 3.97-2.645.765.112 1.559.17 2.358.17 5.523 0 10-3.463 10-7.691S17.523 3 12 3z" />
          </svg>
          카카오로 3초 만에 시작하기
        </button>

        {/* Sign In Link */}
        <p className="text-center mt-6 text-[#6B7684]">
          이미 계정이 있으신가요?{' '}
          <Link href="/signin" className="text-[#FF5722] font-semibold hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
