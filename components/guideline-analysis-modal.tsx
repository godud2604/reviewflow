'use client';

import { useState } from 'react';
import type { CampaignGuidelineAnalysis } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Z_INDEX } from '@/lib/z-index';

interface GuidelineAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (analysis: CampaignGuidelineAnalysis) => void;
}

const toList = (items?: string[]) => (Array.isArray(items) ? items.filter(Boolean) : []);

const visitTypeLabel: Record<string, string> = {
  visit: '방문형',
  delivery: '배송형',
  hybrid: '방문+배송형',
};

export default function GuidelineAnalysisModal({
  isOpen,
  onClose,
  onApply,
}: GuidelineAnalysisModalProps) {
  const [guideline, setGuideline] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CampaignGuidelineAnalysis | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAnalyze = async () => {
    if (!guideline.trim()) {
      toast({
        title: '오류',
        description: '가이드라인 텍스트를 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: '오류',
        description: '사용자 정보를 찾을 수 없습니다',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/parse-guideline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideline, userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('가이드라인 분석 실패');
      }

      const result = await response.json();
      const analysisData = result.data;
      
      toast({
        title: '성공',
        description: '가이드라인이 분석되었습니다',
      });
      
      // 분석 완료 후 바로 적용하고 모달 닫기
      onApply(analysisData);
      onClose();
      
    } catch (error) {
      console.error('분석 오류:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (analysis) {
      navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const copyText = async (key: string, value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleApply = () => {
    if (analysis) {
      onApply(analysis);
      onClose();
    }
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
      <ul className="space-y-1 list-disc list-inside">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );

  if (!isOpen) return null;

  const cards = analysis?.reviewCards;
  const scheduleCard = cards?.scheduleAction;
  const missionCard = cards?.missionSpec;
  const copyCard = cards?.copyPack;
  const appealCard = cards?.productAppeal;
  const riskCard = cards?.riskManagement;
  const productAppealSections = [
    { title: '핵심 장점', items: toList(appealCard?.coreBenefits) },
    { title: '비교 포인트', items: toList(appealCard?.comparisonPoints) },
    { title: '권장 사용 상황', items: toList(appealCard?.recommendedUseCases) },
    { title: '추천 타깃 독자', items: toList(appealCard?.targetAudience) },
    { title: '해결되는 고민', items: toList(appealCard?.painPoints) },
    { title: '핵심 성분/스펙/수치', items: toList(appealCard?.keyIngredientsOrSpecs) },
    { title: '사용 팁', items: toList(appealCard?.usageTips) },
    { title: '전/후 변화 포인트', items: toList(appealCard?.beforeAfterPoints) },
    { title: '신뢰 근거', items: toList(appealCard?.trustSignals) },
    { title: 'FAQ 아이디어', items: toList(appealCard?.faqIdeas) },
    { title: '도입 훅 문장 소재', items: toList(appealCard?.narrativeHooks) },
    { title: '추천 본문 구성', items: toList(appealCard?.recommendedStructure) },
    { title: '마무리 CTA 문구', items: toList(appealCard?.callToAction) },
    { title: '카피 작성 시 주의', items: toList(appealCard?.bannedOrCautionInCopy) },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="fixed inset-0 z-[250] bg-black/50 flex items-center justify-center" style={{ zIndex: Z_INDEX.guidelineAnalysisBackdrop }}>
      <div className="bg-white rounded-xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: Z_INDEX.guidelineAnalysisModal }}>
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">캠페인 가이드라인 분석</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!analysis ? (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  가이드라인 텍스트
                </label>
                <Textarea
                  value={guideline}
                  onChange={(e) => setGuideline(e.target.value)}
                  placeholder="캠페인 가이드라인을 여기에 붙여넣으세요..."
                  className="min-h-64 p-4 border border-neutral-300 rounded-lg resize-none"
                />
              </div>
              <p className="text-xs text-neutral-500">
                전체 가이드라인 텍스트를 복사해 붙여넣으면 5개 카드로 자동 정리됩니다.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="rounded-xl border bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-neutral-800">{analysis.title || '-'}</p>
                <p className="text-neutral-600 mt-1">
                  {analysis.points ? analysis.points.toLocaleString() : '0'}P | 마감 {analysis.reviewRegistrationPeriod?.end || '-'}
                </p>
              </div>

              <div className="rounded-xl border bg-blue-50 p-4">
                <h3 className="font-semibold text-neutral-900 mb-3">1. 일정 및 예약</h3>
                <div className="space-y-1 text-sm text-neutral-700">
                  <p>유형: {scheduleCard?.visitType ? visitTypeLabel[scheduleCard.visitType] ?? scheduleCard.visitType : '-'}</p>
                  <p>주소: {scheduleCard?.address || analysis.visitInfo || '-'}</p>
                  <p>예약 방법: {scheduleCard?.reservationMethod || analysis.phone || '-'}</p>
                  <p>가능 시간: {scheduleCard?.availableHours || '-'}</p>
                  <p>마감 기한: {scheduleCard?.deliveryDeadline || analysis.reviewRegistrationPeriod?.end || '-'}</p>
                </div>
              </div>

              <div className="rounded-xl border bg-orange-50 p-4">
                <h3 className="font-semibold text-neutral-900 mb-3">2. 콘텐츠 미션</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-neutral-700">
                  <p>글자 수: {missionCard?.minChars ? `${missionCard.minChars}자` : '-'}</p>
                  <p>사진 수: {missionCard?.minPhotos ? `${missionCard.minPhotos}장` : '-'}</p>
                  <p>영상 필수: {missionCard?.videoRequired === undefined ? '-' : missionCard.videoRequired ? '필수' : '선택'}</p>
                </div>
                {toList(missionCard?.requirements).length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-neutral-700 list-disc list-inside">
                    {toList(missionCard?.requirements).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
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

              {productAppealSections.length > 0 && (
                <div className="rounded-xl border bg-indigo-50 p-4">
                  <h3 className="font-semibold text-neutral-900 mb-3">4. 제품 소구점</h3>
                  <div className="space-y-3 text-xs text-neutral-700">
                    {productAppealSections.map((section) =>
                      renderListSection(section.title, section.items)
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-rose-50 p-4">
                <h3 className="font-semibold text-neutral-900 mb-3">5. 주의사항</h3>
                <div className="space-y-2 text-xs text-neutral-700">
                  <p><span className="font-semibold">필수 문구:</span> {toList(riskCard?.requiredNotices).join(' / ') || '-'}</p>
                  <p><span className="font-semibold">금지 표현:</span> {toList(riskCard?.bannedPhrases).join(' / ') || '-'}</p>
                  <p><span className="font-semibold">유지 기간:</span> {toList(riskCard?.retentionPeriod).join(' / ') || '-'}</p>
                  <p><span className="font-semibold">리스크:</span> {toList(riskCard?.warnings).join(' / ') || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex gap-2 justify-end bg-neutral-50">
          {analysis && (
            <Button
              variant="outline"
              onClick={handleCopyJson}
              className="flex items-center gap-2"
            >
              {copiedJson ? <Check size={16} /> : <Copy size={16} />}
              {copiedJson ? 'JSON 복사됨' : 'JSON 복사'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          {!analysis ? (
            <Button onClick={handleAnalyze} disabled={loading} className="flex items-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? '분석 중...' : '분석하기'}
            </Button>
          ) : (
            <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700">
              이 데이터로 일정 생성
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
