"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    const setupSessionFromHash = async () => {
      if (typeof window === "undefined") return
      const hash = window.location.hash.replace(/^#/, "")
      if (!hash) {
        setSessionError("유효한 링크가 아닙니다. 다시 요청해주세요.")
        return
      }

      const params = new URLSearchParams(hash)
      const type = params.get("type")
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")

      if (type !== "recovery" || !accessToken || !refreshToken) {
        setSessionError("링크가 만료되었거나 잘못된 요청입니다.")
        return
      }

      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        console.error("세션 설정 오류:", error)
        setSessionError("링크를 처리하는 데 실패했습니다. 다시 요청해주세요.")
        return
      }

      setTokenReady(true)
      window.history.replaceState(null, "", window.location.pathname)
    }

    setupSessionFromHash()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setMessage(null)

    if (newPassword.length < 6) {
      setFormError("비밀번호는 6자 이상이어야 합니다.")
      return
    }

    if (newPassword !== confirmPassword) {
      setFormError("비밀번호가 일치하지 않습니다.")
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        console.error("비밀번호 갱신 오류:", error)
        setFormError("비밀번호를 변경할 수 없습니다. 다시 시도해주세요.")
        return
      }

      await supabase.auth.signOut()
      setMessage("비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.")
      setTimeout(() => {
        router.replace("/signin")
      }, 1200)
    } catch (err) {
      console.error("비밀번호 갱신 실패:", err)
      setFormError("문제가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white rounded-3xl px-8 pt-6 pb-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold text-[#191F28] mb-3">비밀번호 재설정</h1>
          <p className="text-[#6B7684] text-sm">{sessionError}</p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center w-full rounded-xl border border-[#FF5722] text-[#FF5722] px-4 py-3 font-semibold hover:bg-[#FFEBE1] transition"
          >
            다시 요청하기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-3xl px-8 pt-4 pb-8 shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#191F28]">새로운 비밀번호 설정</h1>
          <p className="text-[#6B7684] mt-2">안내된 링크를 사용 중입니다.</p>
        </div>

        {!tokenReady && (
          <div className="text-center text-[#6B7684] mb-6">
            링크를 처리 중입니다... 잠시만 기다려주세요.
          </div>
        )}

        {tokenReady && (
          <>
            {formError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {formError}
              </div>
            )}

            {message && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#333D4B] mb-2">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#333D4B] mb-2">
                  비밀번호 확인
                </label>
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
                {loading ? "저장 중..." : "비밀번호 변경"}
              </button>
            </form>
          </>
        )}

        <p className="text-center mt-6 text-[#6B7684] text-sm">
          <Link href="/signin" className="text-[#FF5722] font-semibold hover:underline">
            로그인 화면으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
