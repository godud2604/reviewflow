"use client"

import { useState } from "react"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase"
import { getRedirectUrl } from "@/lib/getRedirectUrl"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl("/reset-password"),
      })

      if (error) {
        setError("비밀번호 재설정 이메일 발송에 실패했습니다.")
        return
      }

      setMessage("이메일을 확인하셔서 안내된 링크로 비밀번호를 재설정하세요.")
    } catch (err) {
      console.error("비밀번호 찾기 오류:", err)
      setError("문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-3xl px-8 pt-4 pb-8 shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#191F28]">비밀번호 찾기</h1>
          <p className="text-[#6B7684] mt-2">가입한 이메일로 안내를 보내드립니다.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {message}
          </div>
        )}

          <div>
            <label className="block text-sm font-medium text-[#333D4B] mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF5722] focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#FF5722] text-white py-3 rounded-xl font-semibold hover:bg-[#E64A19] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "전송 중..." : "비밀번호 재설정 링크 받기"}
          </button>

        <p className="text-center mt-6 text-[#6B7684] text-sm">
          <Link href="/signin" className="text-[#FF5722] font-semibold hover:underline">
            로그인 화면으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  )
}
