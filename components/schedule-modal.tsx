"use client"

import { useState, useEffect } from "react"
import type { Schedule } from "@/types"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

const PLATFORMS = ["레뷰", "리뷰노트", "스타일씨", "리뷰플레이스"]

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
    status: "선정됨",
    platform: "",
    reviewType: "제공형",
    channel: "네이버블로그",
    category: "맛집",
    region: "",
    visit: "",
    dead: "",
    benefit: 0,
    income: 0,
    cost: 0,
    postingLink: "",
    purchaseLink: "",
    guideLink: "",
    guideFiles: [],
    memo: "",
  })

  const [customPlatforms, setCustomPlatforms] = useState<string[]>([])
  const [newPlatform, setNewPlatform] = useState("")
  const [showPlatformInput, setShowPlatformInput] = useState(false)

  useEffect(() => {
    if (schedule) {
      setFormData(schedule)
    } else {
      setFormData({
        title: "",
        status: "선정됨",
        platform: "",
        reviewType: "제공형",
        channel: "네이버블로그",
        category: "맛집",
        region: "",
        visit: "",
        dead: "",
        benefit: 0,
        income: 0,
        cost: 0,
        postingLink: "",
        purchaseLink: "",
        guideLink: "",
        guideFiles: [],
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

  const formatNumber = (value: number) => {
    return value.toLocaleString()
  }

  const parseNumber = (value: string) => {
    return Number(value.replace(/,/g, ""))
  }

  const handleNumberChange = (field: "benefit" | "income" | "cost", value: string) => {
    const numValue = parseNumber(value)
    setFormData({ ...formData, [field]: numValue })
  }

  const addCustomPlatform = () => {
    if (newPlatform.trim()) {
      setCustomPlatforms([...customPlatforms, newPlatform.trim()])
      setFormData({ ...formData, platform: newPlatform.trim() })
      setNewPlatform("")
      setShowPlatformInput(false)
    }
  }

  const allPlatforms = [...PLATFORMS, ...customPlatforms]

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
          {/* 체험단명 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2">체험단명 (필수)</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            placeholder="예: 강남역 파스타"
          />

          {/* 플랫폼 */}
          <div className="mt-6">
            <label className="block text-[13px] font-bold text-neutral-500 mb-2">플랫폼</label>
            <select
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            >
              <option value="">선택하세요</option>
              {allPlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
            {!showPlatformInput ? (
              <button
                onClick={() => setShowPlatformInput(true)}
                className="mt-2 text-xs text-[#FF5722] font-semibold"
              >
                + 플랫폼 추가
              </button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  className="flex-1 p-2 bg-[#F7F7F8] border-none rounded-lg text-sm"
                  placeholder="새 플랫폼 이름"
                  onKeyPress={(e) => e.key === "Enter" && addCustomPlatform()}
                />
                <button
                  onClick={addCustomPlatform}
                  className="px-3 py-2 bg-[#FF5722] text-white rounded-lg text-xs font-semibold"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setShowPlatformInput(false)
                    setNewPlatform("")
                  }}
                  className="px-3 py-2 bg-neutral-200 text-neutral-600 rounded-lg text-xs font-semibold"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          {/* 체험단 유형 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">체험단 유형</label>
          <div className="flex gap-2 flex-wrap">
            {["제공형", "페이백형", "페이백+구매평", "구매평", "기자단", "미션/인증", "방문형", "배달형"].map(
              (type) => (
                <div
                  key={type}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      reviewType: type as Schedule["reviewType"],
                    })
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    formData.reviewType === type
                      ? "bg-orange-50 text-[#FF5722] border border-[#FF5722]"
                      : "bg-[#F7F7F8] text-neutral-500"
                  }`}
                >
                  {type}
                </div>
              ),
            )}
          </div>

          {/* 작성 채널 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">작성 채널</label>
          <div className="flex gap-2 flex-wrap">
            {[
              "네이버블로그",
              "인스타그램",
              "인스타그램 reels",
              "네이버클립",
              "유튜브 shorts",
              "틱톡",
              "threads",
              "기타(구매평/인증)",
            ].map((channel) => (
              <div
                key={channel}
                onClick={() =>
                  setFormData({
                    ...formData,
                    channel: channel as Schedule["channel"],
                  })
                }
                className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  formData.channel === channel
                    ? "bg-blue-50 text-blue-600 border border-blue-600"
                    : "bg-[#F7F7F8] text-neutral-500"
                }`}
              >
                {channel}
              </div>
            ))}
          </div>

          {/* 카테고리 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">카테고리</label>
          <div className="flex gap-2 flex-wrap">
            {["맛집", "식품", "뷰티", "여행", "디지털", "반려동물", "기타"].map((category) => (
              <div
                key={category}
                onClick={() =>
                  setFormData({
                    ...formData,
                    category: category as Schedule["category"],
                  })
                }
                className={`px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer ${
                  formData.category === category
                    ? "bg-purple-50 text-purple-600 border border-purple-600"
                    : "bg-[#F7F7F8] text-neutral-500"
                }`}
              >
                {category}
              </div>
            ))}
          </div>

          {/* 지역 */}
          <div className="mt-6">
            <label className="block text-[13px] font-bold text-neutral-500 mb-2">지역</label>
            <select
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            >
              <option value="">선택하세요</option>
              {[
                "서울",
                "경기",
                "인천",
                "강원",
                "대전",
                "세종",
                "충남",
                "충북",
                "부산",
                "울산",
                "경남",
                "경북",
                "대구",
                "광주",
                "전남",
                "전북",
                "제주",
              ].map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          {/* 진행 상태 */}
          <div className="mt-6">
            <label className="block text-[13px] font-bold text-neutral-500 mb-2">진행 상태</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Schedule["status"] })}
              className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            >
              <option value="선정됨">선정됨</option>
              <option value="예약">예약</option>
              <option value="방문">방문</option>
              <option value="완료">완료</option>
              <option value="취소">취소</option>
              <option value="재확인">재확인</option>
            </select>
          </div>

          {/* 날짜 */}
          <div className="flex gap-2.5 mt-6">
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-neutral-500 mb-2">방문일</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base text-left">
                    {formData.visit ? format(new Date(formData.visit), "PPP", { locale: ko }) : "날짜 선택"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.visit ? new Date(formData.visit) : undefined}
                    onSelect={(date) =>
                      setFormData({
                        ...formData,
                        visit: date ? format(date, "yyyy-MM-dd") : "",
                      })
                    }
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-bold text-[#FF5722] mb-2">마감일</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base text-left">
                    {formData.dead ? format(new Date(formData.dead), "PPP", { locale: ko }) : "날짜 선택"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dead ? new Date(formData.dead) : undefined}
                    onSelect={(date) =>
                      setFormData({
                        ...formData,
                        dead: date ? format(date, "yyyy-MM-dd") : "",
                      })
                    }
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 자산 관리 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">자산 관리 (단위: 원)</label>
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex gap-2.5">
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-neutral-400 font-semibold mb-2">제공(물품)</span>
              <input
                type="text"
                value={formatNumber(formData.benefit || 0)}
                onChange={(e) => handleNumberChange("benefit", e.target.value)}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-neutral-400 font-semibold mb-2">수익(현금)</span>
              <input
                type="text"
                value={formatNumber(formData.income || 0)}
                onChange={(e) => handleNumberChange("income", e.target.value)}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold"
                placeholder="0"
              />
            </div>
            <div className="flex-1 text-center">
              <span className="block text-[11px] text-red-600 font-semibold mb-2">내 지출</span>
              <input
                type="text"
                value={formatNumber(formData.cost || 0)}
                onChange={(e) => handleNumberChange("cost", e.target.value)}
                className="w-full p-3 bg-white border-none rounded-xl text-center font-bold text-red-600"
                placeholder="0"
              />
            </div>
          </div>

          {/* 링크 */}
          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-6">포스팅 링크</label>
          <input
            type="url"
            value={formData.postingLink}
            onChange={(e) => setFormData({ ...formData, postingLink: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            placeholder="https://..."
          />

          {formData.category === "디지털" && (
            <>
              <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-4">구매할 링크</label>
              <input
                type="url"
                value={formData.purchaseLink}
                onChange={(e) => setFormData({ ...formData, purchaseLink: e.target.value })}
                className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
                placeholder="https://..."
              />
            </>
          )}

          <label className="block text-[13px] font-bold text-neutral-500 mb-2 mt-4">가이드 링크</label>
          <input
            type="url"
            value={formData.guideLink}
            onChange={(e) => setFormData({ ...formData, guideLink: e.target.value })}
            className="w-full p-4 bg-[#F7F7F8] border-none rounded-xl text-base"
            placeholder="https://..."
          />

          {/* 메모장 */}
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
