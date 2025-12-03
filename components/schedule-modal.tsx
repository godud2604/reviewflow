"use client"

import { useState, useEffect } from "react"
import type { Schedule } from "@/types"

export default function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  schedule,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (schedule: Schedule) => void
  onDelete: (id: number) => void
  schedule?: Schedule
}) {
  const [formData, setFormData] = useState<Partial<Schedule>>({
    title: "",
    status: "ready",
    platform: "",
    type: "맛집",
    visit: "",
    dead: "",
    benefit: 0,
    income: 0,
    cost: 0,
    link: "",
    memo: "",
  })

  useEffect(() => {
    if (schedule) {
      setFormData(schedule)
    } else {
      setFormData({
        title: "",
        status: "ready",
        platform: "",
        type: "맛집",
        visit: "",
        dead: "",
        benefit: 0,
        income: 0,
        cost: 0,
        link: "",
        memo: "",
      })
    }
  }, [schedule, isOpen])

  const handleSave = () => {
    if (!formData.title) {
      alert("제목을 입력해주세요.")
      return
    }
    onSave(formData as Schedule)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm z-30" onClick={onClose} />
      <div className="absolute bottom-0 left-0 w-full h-[92%] bg-white rounded-t-[30px] z-40 flex flex-col animate-slide-up">
        <div className="px-6 py-5 border-b border-neutral-100 flex justify-between items-center">
          <span onClick={onClose} className="text-neutral-400 font-semibold cursor-pointer">
            취소
          </span>
          <span className="font-bold text-base">체험단 등록</span>
          <span onClick={handleSave} className="text-[#FF5722] font-bold cursor-pointer">
            저장
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <label className="block text-[13px] font-bold text-neutral-500 mb-2">체험단명 (필수)</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            placeholder="예: 강남역 파스타"
          />

          <div className="flex gap-2.5 mt-6">
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-neutral-500 mb-2">진행 상태</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Schedule["status"] })}
                className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
              >
                <option value="ready">선정됨</option>
                <option value="visit">예약/방문</option>
                <option value="done">완료</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-neutral-500 mb-2">플랫폼</label>
              <input
                type="text"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
                placeholder="예: 레뷰"
              />
            </div>
          </div>

          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">체험 종류</label>
          <div className="flex gap-2 flex-wrap">
            {["맛집", "뷰티", "제품", "숙박", "기자단"].map((type) => (
              <div
                key={type}
                onClick={() => setFormData({ ...formData, type: type as Schedule["type"] })}
                className={`px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer ${
                  formData.type === type
                    ? "bg-orange-50 text-[#FF5722] border border-[#FF5722]"
                    : "bg-[#F7F7F8] text-neutral-500"
                }`}
              >
                {type}
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 mt-6">
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-neutral-500 mb-2">방문일 (예약)</label>
              <input
                type="date"
                value={formData.visit}
                onChange={(e) => setFormData({ ...formData, visit: e.target.value })}
                className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-[#FF5722] mb-2">마감일</label>
              <input
                type="date"
                value={formData.dead}
                onChange={(e) => setFormData({ ...formData, dead: e.target.value })}
                className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
              />
            </div>
          </div>

          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">자산 관리 (단위: 원)</label>
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex gap-2.5">
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-neutral-400 font-semibold mb-2">제공(물품)</span>
              <input
                type="number"
                value={formData.benefit}
                onChange={(e) => setFormData({ ...formData, benefit: Number(e.target.value) })}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-neutral-400 font-semibold mb-2">수익(현금)</span>
              <input
                type="number"
                value={formData.income}
                onChange={(e) => setFormData({ ...formData, income: Number(e.target.value) })}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-red-600 font-semibold mb-2">내 지출</span>
              <input
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold text-red-600"
                placeholder="0"
              />
            </div>
          </div>

          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">가이드 / 포스팅 링크</label>
          <input
            type="url"
            value={formData.link}
            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            placeholder="https://..."
          />

          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">메모장</label>
          <textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base resize-none"
            rows={3}
            placeholder="가이드라인 복사 붙여넣기..."
          />

          {schedule && (
            <button
              onClick={() => onDelete(schedule.id)}
              className="w-full p-4 bg-red-50 text-red-600 border-none rounded-2xl font-bold mt-5"
            >
              이 체험단 삭제
            </button>
          )}
        </div>
      </div>
    </>
  )
}
