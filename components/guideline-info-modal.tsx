'use client';

import { useState } from 'react';
import type { CampaignGuidelineAnalysis } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';

interface GuidelineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CampaignGuidelineAnalysis | null;
}

const toList = (items?: string[]) => (Array.isArray(items) ? items.filter(Boolean) : []);

const visitTypeLabel: Record<string, string> = {
  visit: '방문형',
  delivery: '배송형',
  hybrid: '방문+배송형',
};

export default function GuidelineInfoModal({
  isOpen,
  onClose,
  analysis,
}: GuidelineInfoModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!analysis) return null;

  const cards = analysis.reviewCards;
  const scheduleCard = cards?.scheduleAction;
  const missionCard = cards?.missionSpec;
  const copyCard = cards?.copyPack;
  const appealCard = cards?.productAppeal;
  const riskCard = cards?.riskManagement;

  const copyText = async (key: string, value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const renderCopyRows = (title: string, items: string[], keyPrefix: string) => (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const key = `${keyPrefix}-${idx}`;
            return (
              <div key={key} className="flex items-center gap-2 rounded-md border bg-white px-2 py-1.5">
                <p className="flex-1 text-xs text-neutral-700 break-all">{item}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => copyText(key, item)}
                >
                  {copiedKey === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">정보 없음</p>
      )}
    </div>
  );

  const renderListSection = (title: string, items: string[]) => (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-1 list-disc list-inside">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-400">정보 없음</p>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ zIndex: Z_INDEX.guidelineAnalysisModal }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{analysis.title || 'n/a'} - 캠페인 가이드라인</DialogTitle>
          <DialogDescription>
            {analysis.points ? analysis.points.toLocaleString() : '0'}P | 마감: {analysis.reviewRegistrationPeriod?.end || '-'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full">
          <div className="p-4 space-y-4">
            <div className="rounded-xl border bg-blue-50 p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">1. 일정 및 예약</h3>
              <div className="space-y-1 text-sm text-neutral-700">
                <p>유형: {scheduleCard?.visitType ? visitTypeLabel[scheduleCard.visitType] ?? scheduleCard.visitType : '-'}</p>
                <p>주소: {scheduleCard?.address || analysis.visitInfo || '-'}</p>
                <p>예약 방법: {scheduleCard?.reservationMethod || analysis.phone || '-'}</p>
                <p>가능 시간: {scheduleCard?.availableHours || '-'}</p>
                <p>마감 기한: {scheduleCard?.deliveryDeadline || analysis.reviewRegistrationPeriod?.end || '-'}</p>
                <p>회수 여부: {scheduleCard?.pickupRequired === undefined ? '-' : scheduleCard.pickupRequired ? '회수 있음' : '회수 없음'}</p>
              </div>
              {toList(scheduleCard?.actionItems).length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-neutral-700 list-disc list-inside">
                  {toList(scheduleCard?.actionItems).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-orange-50 p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">2. 콘텐츠 미션</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-neutral-700">
                <p>글자 수: {missionCard?.minChars ? `${missionCard.minChars}자` : '-'}</p>
                <p>사진 수: {missionCard?.minPhotos ? `${missionCard.minPhotos}장` : '-'}</p>
                <p>영상 필수: {missionCard?.videoRequired === undefined ? '-' : missionCard.videoRequired ? '필수' : '선택'}</p>
              </div>
              {toList(missionCard?.requiredShots).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-neutral-700 mb-1">필수 촬영 컷</p>
                  <ul className="space-y-1 text-xs text-neutral-700 list-disc list-inside">
                    {toList(missionCard?.requiredShots).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {toList(missionCard?.linkRequirements).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-neutral-700 mb-1">링크 삽입 정보</p>
                  <ul className="space-y-1 text-xs text-neutral-700 list-disc list-inside">
                    {toList(missionCard?.linkRequirements).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {toList(missionCard?.requirements).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-neutral-700 mb-1">기타 규격</p>
                  <ul className="space-y-1 text-xs text-neutral-700 list-disc list-inside">
                    {toList(missionCard?.requirements).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-emerald-50 p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">3. 키워드 및 태그 (복사 전용)</h3>
              <div className="space-y-3">
                {renderCopyRows('제목 키워드', toList(copyCard?.titleKeywords), 'title')}
                {renderCopyRows('본문 키워드', toList(copyCard?.bodyKeywords), 'body')}
                {renderCopyRows('해시태그', toList(copyCard?.hashtags), 'hash')}
                {renderCopyRows('사람 태그', toList(copyCard?.mentionTags), 'mention')}
              </div>
            </div>

            <div className="rounded-xl border bg-indigo-50 p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">4. 제품 소구점</h3>
              <div className="space-y-3 text-xs text-neutral-700">
                {renderListSection('핵심 장점', toList(appealCard?.coreBenefits))}
                {renderListSection('비교 포인트', toList(appealCard?.comparisonPoints))}
                {renderListSection('권장 사용 상황', toList(appealCard?.recommendedUseCases))}
                {renderListSection('추천 타깃 독자', toList(appealCard?.targetAudience))}
                {renderListSection('해결되는 고민', toList(appealCard?.painPoints))}
                {renderListSection('핵심 성분/스펙/수치', toList(appealCard?.keyIngredientsOrSpecs))}
                {renderListSection('사용 팁', toList(appealCard?.usageTips))}
                {renderListSection('전/후 변화 포인트', toList(appealCard?.beforeAfterPoints))}
                {renderListSection('신뢰 근거', toList(appealCard?.trustSignals))}
                {renderListSection('FAQ 아이디어', toList(appealCard?.faqIdeas))}
                {renderListSection('도입 훅 문장 소재', toList(appealCard?.narrativeHooks))}
                {renderListSection('추천 본문 구성', toList(appealCard?.recommendedStructure))}
                {renderListSection('마무리 CTA 문구', toList(appealCard?.callToAction))}
                {renderListSection('카피 작성 시 주의', toList(appealCard?.bannedOrCautionInCopy))}
              </div>
            </div>

            <div className="rounded-xl border bg-rose-50 p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">5. 주의사항</h3>
              <div className="space-y-3 text-xs text-neutral-700">
                <div>
                  <p className="font-semibold mb-1">필수 문구</p>
                  {toList(riskCard?.requiredNotices).length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {toList(riskCard?.requiredNotices).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : <p className="text-neutral-400">정보 없음</p>}
                </div>
                <div>
                  <p className="font-semibold mb-1">금지어/금지 표현</p>
                  {toList(riskCard?.bannedPhrases).length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {toList(riskCard?.bannedPhrases).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : <p className="text-neutral-400">정보 없음</p>}
                </div>
                <div>
                  <p className="font-semibold mb-1">유지 기간</p>
                  {toList(riskCard?.retentionPeriod).length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {toList(riskCard?.retentionPeriod).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : <p className="text-neutral-400">정보 없음</p>}
                </div>
                <div>
                  <p className="font-semibold mb-1">기타 리스크</p>
                  {toList(riskCard?.warnings).length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside text-rose-700">
                      {toList(riskCard?.warnings).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : <p className="text-neutral-400">정보 없음</p>}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
