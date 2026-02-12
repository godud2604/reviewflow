'use client';

import { useState } from 'react';
import type { CampaignGuidelineAnalysis } from '@/types';
import {
  Dialog,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  Check,
  Calendar,
  Gift,
  MapPin,
  Phone,
  ListChecks,
  Loader2,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

interface GuidelineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CampaignGuidelineAnalysis | null;
}

/**
 * 토스 스타일의 섹션 카드 컴포넌트
 */
const SectionCard = ({ title, icon: Icon, children, className }: { title: string, icon: any, children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm mb-4", className)}>
    <div className="flex items-center gap-2 mb-5">
      <div className="p-2 bg-slate-50 rounded-xl">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <h3 className="font-bold text-[18px] text-slate-900 tracking-tight">{title}</h3>
    </div>
    <div className="space-y-5">
      {children}
    </div>
  </div>
);

/**
 * 정보 행 컴포넌트
 */
const InfoRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[13px] font-medium text-slate-400">{label}</span>
    <div className="text-[15px] text-slate-800 leading-relaxed font-medium">
      {children}
    </div>
  </div>
);

const LENGTH_OPTIONS = [500, 1000, 1500, 2000, 3000] as const;
const TONE_OPTIONS = [
  { key: 'auto', label: '자동 설정' },
  { key: 'haeyo', label: '~해요' },
  { key: 'hamnida', label: '~합니다' },
  { key: 'banmal', label: '~한다(반말)' },
] as const;
const PERSONA_OPTIONS = [
  { key: 'balanced', label: '자동 페르소나' },
  { key: 'friendly', label: '친근한 후기형' },
  { key: 'expert', label: '정보형 전문가' },
  { key: 'honest', label: '솔직 리뷰어' },
  { key: 'lifestyle', label: '라이프스타일형' },
] as const;

type DraftLength = (typeof LENGTH_OPTIONS)[number];
type DraftTone = (typeof TONE_OPTIONS)[number]['key'];
type DraftPersona = (typeof PERSONA_OPTIONS)[number]['key'];

export default function GuidelineInfoModal({
  isOpen,
  onClose,
  analysis,
}: GuidelineInfoModalProps) {
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [showDraftSettings, setShowDraftSettings] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [draftLength, setDraftLength] = useState<DraftLength>(1000);
  const [draftTone, setDraftTone] = useState<DraftTone>('auto');
  const [draftPersona, setDraftPersona] = useState<DraftPersona>('balanced');
  const [draftEmphasis, setDraftEmphasis] = useState('');
  const { toast } = useToast();

  if (!analysis) return null;

  const visitReviewTypeLabels: Record<string, string> = {
    naverReservation: '네이버 예약/영수증 리뷰',
    googleReview: '구글 리뷰',
    other: '기타 리뷰',
  };
  const visitReviewTypes = (analysis.contentRequirements?.visitReviewTypes ?? [])
    .map((type) => visitReviewTypeLabels[type] ?? type);
  const displayPoints = analysis.rewardInfo?.points ?? analysis.points;
  const digestSections = (analysis.guidelineDigest?.sections ?? [])
    .filter((section) => section?.title && Array.isArray(section.items) && section.items.length > 0);

  const handleGenerateDraft = async () => {
    setIsDraftOpen(true);
    setIsGeneratingDraft(true);
    setCopiedDraft(false);
    try {
      const response = await fetch('/api/ai/generate-blog-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          options: {
            targetLength: draftLength,
            tone: draftTone,
            persona: draftPersona,
            emphasis: draftEmphasis.trim(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('블로그 초안 생성에 실패했습니다.');
      }

      const result = await response.json();
      const nextDraft = String(result?.data?.draft ?? '').trim();
      if (!nextDraft) {
        throw new Error('초안 결과가 비어 있습니다. 다시 시도해주세요.');
      }

      setDraftText(nextDraft);
      toast({
        title: '초안 생성 완료',
        description: '분석 데이터를 바탕으로 초안이 생성되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '초안 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!draftText.trim()) return;
    await navigator.clipboard.writeText(draftText);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 1500);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-2xl h-[85vh] p-0 !flex !flex-col border-none bg-slate-50 overflow-hidden min-h-0"
          style={{ zIndex: Z_INDEX.guidelineAnalysisModal, borderRadius: '32px' }}
        >
          <DialogHeader className="p-6 pb-4 bg-white flex-shrink-0">
            <DialogTitle className="text-[22px] font-bold tracking-tight text-slate-900 leading-tight">
              {analysis.title || '캠페인 가이드라인'}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[14px] font-bold text-[#FF5722] bg-orange-50 px-3 py-1 rounded-full">
                {analysis.points?.toLocaleString() ?? 0}P 적립
              </span>
              <span className="text-[14px] text-slate-400 font-medium">
                마감일: {analysis.reviewRegistrationPeriod?.end || '-'}
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 w-full outline-none">
            <div className="px-5 py-2 pb-10">
              <SectionCard title="기본 정보" icon={Sparkles}>
                <InfoRow label="플랫폼">{analysis.platform || '-'}</InfoRow>
                <InfoRow label="카테고리">{analysis.category || '-'}</InfoRow>
                <InfoRow label="리뷰 채널">{analysis.reviewChannel || '-'}</InfoRow>
              </SectionCard>

              <SectionCard title="일정 정보" icon={Calendar}>
                <InfoRow label="시작일">{analysis.reviewRegistrationPeriod?.start || '-'}</InfoRow>
                <InfoRow label="마감일">{analysis.reviewRegistrationPeriod?.end || '-'}</InfoRow>
              </SectionCard>

              <SectionCard title="리워드 정보" icon={Gift}>
                <InfoRow label="보상 금액">{displayPoints ? `${displayPoints.toLocaleString()}P` : '-'}</InfoRow>
                <InfoRow label="리워드 설명">{analysis.rewardInfo?.description || '-'}</InfoRow>
                <InfoRow label="제공 방식">{analysis.rewardInfo?.deliveryMethod || '-'}</InfoRow>
                <InfoRow label="제품 정보">{analysis.rewardInfo?.productInfo || '-'}</InfoRow>
              </SectionCard>

              {(analysis.visitInfo || analysis.phone || visitReviewTypes.length > 0) && (
                <SectionCard title="방문 정보" icon={MapPin}>
                  <InfoRow label="주소/위치">{analysis.visitInfo || '-'}</InfoRow>
                  <InfoRow label="전화번호">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {analysis.phone || '-'}
                    </span>
                  </InfoRow>
                  <InfoRow label="방문 리뷰 필수 항목">
                    {visitReviewTypes.length > 0 ? visitReviewTypes.join(', ') : '-'}
                  </InfoRow>
                </SectionCard>
              )}

              {(analysis.guidelineDigest?.summary || digestSections.length > 0) && (
                <SectionCard title="가이드라인 정리" icon={ListChecks}>
                  {analysis.guidelineDigest?.summary && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {analysis.guidelineDigest.summary}
                      </p>
                    </div>
                  )}

                  {digestSections.map((section, sectionIdx) => (
                    <div key={`${section.title}-${sectionIdx}`} className="space-y-2">
                      <p className="text-[14px] font-bold text-slate-900">{section.title}</p>
                      <ul className="space-y-1.5">
                        {section.items.map((item, itemIdx) => (
                          <li key={`${section.title}-${itemIdx}`} className="flex gap-2">
                            <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                            <span className="text-[14px] text-slate-700 leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </SectionCard>
              )}
            </div>
          </ScrollArea>

          <div className="p-5 bg-white border-t border-slate-50 flex-shrink-0 grid grid-cols-2 gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="h-14 rounded-[20px] border-slate-200 text-[16px] font-bold text-slate-700 hover:bg-slate-50"
            >
              확인
            </Button>
            <Button
              onClick={handleGenerateDraft}
              disabled={isGeneratingDraft}
              className="h-14 rounded-[20px] bg-[#FF5722] hover:bg-[#FF7A4C] text-white text-[16px] font-bold transition-all shadow-orange-100 shadow-lg active:scale-[0.98]"
            >
              {isGeneratingDraft ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  초안 생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  블로그 초안 작성
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDraftOpen} onOpenChange={setIsDraftOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0" style={{ zIndex: Z_INDEX.guidelineAnalysisModal + 1 }}>
          <DialogHeader className="p-6 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-[20px] font-bold text-slate-900">블로그 초안</DialogTitle>
                <DialogDescription className="mt-1 text-slate-500">
                  분석된 가이드라인 데이터를 기반으로 초안을 생성했습니다.
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-200 text-slate-600"
                onClick={() => setShowDraftSettings((prev) => !prev)}
              >
                <Settings2 className="w-3.5 h-3.5" />
                세팅
              </Button>
            </div>
          </DialogHeader>

          {showDraftSettings && (
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-slate-600">페르소나</p>
                <div className="flex flex-wrap gap-2">
                  {PERSONA_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setDraftPersona(option.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[13px] border transition-colors',
                        draftPersona === option.key
                          ? 'bg-orange-50 text-[#FF5722] border-orange-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-slate-600">글자 수</p>
                <div className="flex flex-wrap gap-2">
                  {LENGTH_OPTIONS.map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => setDraftLength(length)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[13px] border transition-colors',
                        draftLength === length
                          ? 'bg-orange-50 text-[#FF5722] border-orange-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {length}자
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-slate-600">글 스타일(말투)</p>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setDraftTone(option.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-[13px] border transition-colors',
                        draftTone === option.key
                          ? 'bg-orange-50 text-[#FF5722] border-orange-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-slate-600">강조 내용 (선택)</p>
                <Textarea
                  value={draftEmphasis}
                  onChange={(event) => setDraftEmphasis(event.target.value.slice(0, 300))}
                  placeholder="강조하고 싶은 내용이나 요청사항을 입력하세요."
                  className="min-h-24 bg-white border-slate-200"
                />
                <p className="text-[12px] text-slate-400 text-right">{draftEmphasis.length}/300</p>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-h-[280px] max-h-[50vh] overflow-y-auto">
              {isGeneratingDraft ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mb-2" />
                  초안을 생성하고 있습니다...
                </div>
              ) : draftText ? (
                <pre className="whitespace-pre-wrap break-words text-[14px] leading-7 text-slate-700 font-medium">{draftText}</pre>
              ) : (
                <p className="text-[14px] text-slate-400">아직 생성된 초안이 없습니다.</p>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 sm:justify-between">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-slate-200"
              onClick={handleGenerateDraft}
              disabled={isGeneratingDraft}
            >
              {isGeneratingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              다시 생성
            </Button>
            <div className="flex w-full sm:w-auto gap-2">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none border-slate-200"
                onClick={handleCopyDraft}
                disabled={!draftText.trim()}
              >
                {copiedDraft ? <Check className="w-4 h-4 text-[#FF5722]" /> : <Copy className="w-4 h-4" />}
                {copiedDraft ? '복사됨' : '초안 복사'}
              </Button>
              <Button className="flex-1 sm:flex-none bg-[#FF5722] hover:bg-[#FF7A4C]" onClick={() => setIsDraftOpen(false)}>
                닫기
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
