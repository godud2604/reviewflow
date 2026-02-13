'use client';

import { useEffect, useState } from 'react';
import type { CampaignGuidelineAnalysis, BlogDraftOptions } from '@/types';
import {
  Dialog,
  DialogDescription,
  DialogContent,
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
  CheckCircle2,
  Phone,
  Loader2,
  Sparkles,
  Settings2,
  X,
  ChevronDown,
  ChevronRight,
  Wallet,
  Calendar,
} from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

interface GuidelineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CampaignGuidelineAnalysis | null;
  onApplyToSchedule: () => void;
  originalGuideline?: string;
  scheduleId?: number;
  userId?: string;
  initialDraftText?: string;
  initialDraftOptions?: BlogDraftOptions | null;
  onDraftGenerated?: (payload: {
    draft: string;
    options: BlogDraftOptions;
    updatedAt: string;
  }) => void;
}

/**
 * 토스 스타일 섹션 카드
 */
const SectionCard = ({
  title,
  children,
  headerAction,
}: {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) => (
  <div className="bg-white rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
    <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
      <h3 className="min-w-0 flex-1 break-words font-bold text-[18px] sm:text-[19px] text-[#191F28] tracking-tight">{title}</h3>
      {headerAction ? <div className="w-full sm:w-auto sm:ml-auto">{headerAction}</div> : null}
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

/**
 * 정보 행 컴포넌트
 */
const InfoRow = ({ label, children, icon: Icon }: { label: string, children: React.ReactNode, icon?: any }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className="text-[13px] font-medium text-[#8B95A1] flex items-center gap-1">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
    <div className="text-[16px] text-[#333D4B] leading-relaxed font-semibold break-words">
      {children}
    </div>
  </div>
);

const LENGTH_OPTIONS = [500, 1000, 1500, 2000, 3000] as const;
const TONE_OPTIONS = [
  { key: 'auto', label: '자동 설정' },
  { key: 'haeyo', label: '~해요' },
  { key: 'hamnida', label: '~합니다' },
  { key: 'banmal', label: '~한다' },
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

function normalizeDraftKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const keyword = value.trim().replace(/\s+/g, ' ');
    if (!keyword || keyword.length > 24) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
    if (result.length >= 20) break;
  }
  return result;
}

export default function GuidelineInfoModal({
  isOpen,
  onClose,
  analysis,
  onApplyToSchedule,
  originalGuideline,
  scheduleId,
  userId,
  initialDraftText,
  initialDraftOptions,
  onDraftGenerated,
}: GuidelineInfoModalProps) {
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [guidelineView, setGuidelineView] = useState<'digest' | 'original'>('digest');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isCheckingDraftQuota, setIsCheckingDraftQuota] = useState(false);
  const [canGenerateDraftToday, setCanGenerateDraftToday] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [draftKeywords, setDraftKeywords] = useState<string[]>([]);
  const [draftLength, setDraftLength] = useState<DraftLength>(1000);
  const [draftTone, setDraftTone] = useState<DraftTone>('auto');
  const [draftPersona, setDraftPersona] = useState<DraftPersona>('balanced');
  const [draftEmphasis, setDraftEmphasis] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) setGuidelineView('digest');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftText(initialDraftText || '');
    if (!initialDraftOptions) {
      setDraftLength(1000);
      setDraftTone('auto');
      setDraftPersona('balanced');
      setDraftEmphasis('');
      return;
    }
    setDraftLength(initialDraftOptions.targetLength);
    setDraftTone(initialDraftOptions.tone);
    setDraftPersona(initialDraftOptions.persona);
    setDraftEmphasis(initialDraftOptions.emphasis || '');
    setDraftKeywords(normalizeDraftKeywords(initialDraftOptions.keywords ?? []));
  }, [initialDraftOptions, initialDraftText, isOpen]);

  useEffect(() => {
    if (!isOpen || !analysis) return;
    if (initialDraftOptions?.keywords && initialDraftOptions.keywords.length > 0) return;
    setDraftKeywords(normalizeDraftKeywords(analysis.keywords ?? []));
  }, [analysis, initialDraftOptions?.keywords, isOpen]);

  useEffect(() => {
    if (!isDraftOpen || !userId) return;

    let active = true;
    const fetchQuota = async () => {
      setIsCheckingDraftQuota(true);
      try {
        const response = await fetch(`/api/ai/quota-status?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          if (active) setCanGenerateDraftToday(true);
          return;
        }
        const result = await response.json();
        if (!active) return;
        setCanGenerateDraftToday(Boolean(result?.data?.blogDraft?.allowed));
      } catch (error) {
        if (active) setCanGenerateDraftToday(true);
        console.error('블로그 초안 쿼터 조회 오류:', error);
      } finally {
        if (active) setIsCheckingDraftQuota(false);
      }
    };

    fetchQuota();
    return () => {
      active = false;
    };
  }, [isDraftOpen, userId]);

  if (!analysis) return null;

  const visitReviewTypeLabels: Record<string, string> = {
    naverReservation: '네이버 예약/영수증 리뷰',
    googleReview: '구글 리뷰',
    other: '기타 리뷰',
  };
  const visitReviewTypes = (analysis.contentRequirements?.visitReviewTypes ?? [])
    .map((type) => visitReviewTypeLabels[type] ?? type);
  const displayPoints = analysis.rewardInfo?.points ?? analysis.points;
  const hasOriginalGuideline = Boolean(originalGuideline?.trim());
  const analysisKeywords = normalizeDraftKeywords(analysis.keywords ?? []);
  const digestSummary = (() => {
    const structured = typeof analysis.guidelineDigest?.summary === 'string'
      ? analysis.guidelineDigest.summary.trim()
      : '';
    const legacy = typeof (analysis as any).summary === 'string'
      ? String((analysis as any).summary).trim()
      : '';
    return structured || legacy;
  })();
  const digestSections = (analysis.guidelineDigest?.sections ?? [])
    .filter((section) => section?.title && Array.isArray(section.items) && section.items.length > 0);

  const handleOpenDraftModal = () => {
    setIsDraftOpen(true);
    setCopiedDraft(false);
  };

  const handleGenerateDraft = async () => {
    if (!canGenerateDraftToday) {
      toast({
        title: '오늘 사용 완료',
        description: '블로그 초안 생성은 하루 1회만 가능합니다. 내일 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingDraft(true);
    setCopiedDraft(false);
    try {
      const response = await fetch('/api/ai/generate-blog-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          userId,
          scheduleId,
          originalGuideline,
          options: {
            targetLength: draftLength,
            tone: draftTone,
            persona: draftPersona,
            emphasis: draftEmphasis.trim(),
            keywords: draftKeywords,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '블로그 초안 생성에 실패했습니다.');
      }

      const result = await response.json();
      const nextDraft = String(result?.data?.draft ?? '').trim();
      if (!nextDraft) throw new Error('초안 결과가 비어 있습니다. 다시 시도해주세요.');

      const usedOptions: BlogDraftOptions = {
        targetLength: draftLength,
        tone: draftTone,
        persona: draftPersona,
        emphasis: draftEmphasis.trim(),
        keywords: draftKeywords,
      };
      setDraftText(nextDraft);
      setCanGenerateDraftToday(false);
      onDraftGenerated?.({
        draft: nextDraft,
        options: usedOptions,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: '초안 생성 완료', description: '분석 데이터를 바탕으로 초안이 생성되었습니다.' });
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

  const handleCopyKeywords = async () => {
    if (analysisKeywords.length === 0) return;
    await navigator.clipboard.writeText(analysisKeywords.join(', '));
    setCopiedKeywords(true);
    setTimeout(() => setCopiedKeywords(false), 1500);
  };

  const handleAddKeyword = () => {
    const normalized = keywordInput.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    if (normalized.length > 24 || draftKeywords.length >= 20) return;
    if (draftKeywords.some((k) => k.toLowerCase() === normalized.toLowerCase())) {
      setKeywordInput('');
      return;
    }
    setDraftKeywords((prev) => [...prev, normalized]);
    setKeywordInput('');
  };

  const handleRemoveKeyword = (target: string) => {
    setDraftKeywords((prev) => prev.filter((keyword) => keyword !== target));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    handleAddKeyword();
  };

  return (
    <>
      {/* 1. 메인 가이드라인 모달 */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="w-[calc(100vw-1.25rem)] max-w-[540px] h-[85vh] p-0 border-none bg-[#F2F4F6] overflow-x-hidden overflow-y-hidden flex flex-col shadow-2xl"
          style={{ zIndex: Z_INDEX.guidelineAnalysisModal, borderRadius: '32px' }}
        >
          <DialogHeader className="p-7 pb-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <DialogTitle className="text-[22px] font-bold text-[#191F28] tracking-tight">
              {analysis.title || '캠페인 가이드라인'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-3 sm:px-5 py-4 space-y-4 pb-28">
                <SectionCard title="핵심 정보">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <InfoRow label="보상 금액" icon={Wallet}>
                      <span className="text-[#FF5722] font-bold">
                        {displayPoints ? `${displayPoints.toLocaleString()}P` : '-'}
                      </span>
                    </InfoRow>
                    <InfoRow label="마감일" icon={Calendar}>{analysis.reviewRegistrationPeriod?.end || '-'}</InfoRow>
                    <InfoRow label="플랫폼">{analysis.platform || '-'}</InfoRow>
                    <InfoRow label="리뷰 채널">{analysis.reviewChannel || '-'}</InfoRow>
                    <InfoRow label="전화번호" icon={Phone}>{analysis.phone || '-'}</InfoRow>
                    <InfoRow label="방문 리뷰 항목">{visitReviewTypes.join(', ') || '-'}</InfoRow>
                  </div>
                  <div className="pt-2">
                    {/* [수정] 내 일정에 반영하기 버튼 디자인 */}
                    <button 
                      onClick={onApplyToSchedule}
                      className="w-full h-[56px] bg-[#FFF0E6] text-[#FF5722] rounded-[18px] text-[16px] font-bold flex items-center justify-center gap-1 hover:bg-[#FFE8D9] transition-all active:scale-[0.98]"
                    >
                      내 일정에 반영하기 <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </SectionCard>

                <SectionCard 
                  title="체크리스트"
                  headerAction={
                    /* [수정] 블로그 초안 작성 버튼 디자인 */
                    <button 
                      onClick={handleOpenDraftModal}
                      className="w-full sm:w-auto h-10 text-[13px] sm:text-[14px] font-bold text-[#FF5722] inline-flex items-center justify-center gap-1.5 px-4 bg-white border border-[#FFD7C2] rounded-full hover:bg-[#FFF7F2] shadow-sm transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-[#FF5722]" /> 블로그 초안 작성 (Beta)
                    </button>
                  }
                >
                  <div className="flex bg-[#F2F4F6] p-1.5 rounded-[14px] border border-gray-100">
                    {['digest', 'original'].map((v) => (
                      <button
                        key={v}
                        className={cn(
                          "flex-1 h-10 text-[14px] font-bold rounded-[10px] transition-all",
                          guidelineView === v ? "bg-white text-[#191F28] shadow-sm border border-gray-100" : "text-[#8B95A1]"
                        )}
                        onClick={() => setGuidelineView(v as any)}
                      >{v === 'digest' ? '가이드 요약' : '원본 보기'}</button>
                    ))}
                  </div>

                  {guidelineView === 'digest' ? (
                    <div className="space-y-6 pt-2">
                      {digestSummary && (
                        <div className="rounded-2xl bg-[#F9FAFB] border border-gray-100 p-4 space-y-2">
                          <p className="text-[13px] font-bold text-[#6B7684]">한눈에 요약</p>
                          <p className="text-[14px] text-[#333D4B] leading-relaxed whitespace-pre-wrap">{digestSummary}</p>
                        </div>
                      )}
                      {analysisKeywords.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[15px] font-bold text-[#4E5968]">필수 키워드</p>
                            <button onClick={handleCopyKeywords} className="text-[12px] text-[#8B95A1] flex items-center gap-1">
                              {copiedKeywords ? <Check className="w-3 h-3 text-[#FF5722]" /> : <Copy className="w-3 h-3" />} 복사
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {analysisKeywords.map((k) => (
                              <span key={k} className="max-w-full break-all px-3 py-1.5 bg-[#F9FAFB] text-[#4E5968] rounded-full text-[13px] font-medium border border-gray-100">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {digestSections.map((s, i) => (
                        <div key={i} className="space-y-3">
                          <p className="text-[15px] font-bold text-[#191F28]">{s.title}</p>
                          <ul className="space-y-2">
                            {s.items.map((item, j) => (
                              <li key={j} className="flex gap-2.5 items-start text-[14px] text-[#4E5968] leading-relaxed bg-[#FCFCFD] border border-gray-100 rounded-xl px-3 py-2.5">
                                <CheckCircle2 className="mt-0.5 w-4 h-4 text-[#FF5722] shrink-0" /> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {!digestSummary && digestSections.length === 0 && (
                        <div className="rounded-2xl bg-[#F9FAFB] border border-dashed border-gray-200 p-5 text-center text-[14px] text-[#8B95A1]">
                          요약 데이터를 불러오지 못했습니다. 원본 보기를 확인해주세요.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[14px] text-[#4E5968] leading-relaxed whitespace-pre-wrap bg-[#F9FAFB] p-5 rounded-2xl border border-gray-100">
                      {hasOriginalGuideline ? originalGuideline : '원본 가이드라인이 없습니다.'}
                    </div>
                  )}
                </SectionCard>
              </div>
            </ScrollArea>
          </div>

          <div className="p-4 sm:p-6 bg-white border-t border-gray-50">
            <Button onClick={onClose} className="w-full h-14 rounded-[22px] bg-[#191F28] text-white text-[17px] font-bold active:scale-[0.98] transition-transform">확인</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. 블로그 초안 모달 (기존 디자인 유지) */}
      <Dialog open={isDraftOpen} onOpenChange={setIsDraftOpen}>
        <DialogContent 
          className="w-[calc(100vw-1.25rem)] max-w-[600px] h-[90vh] p-0 border-none bg-[#F2F4F6] overflow-x-hidden overflow-y-hidden flex flex-col shadow-2xl"
          style={{ zIndex: Z_INDEX.guidelineAnalysisModal + 1, borderRadius: '32px' }}
        >
          <DialogHeader className="p-7 bg-white">
            <DialogTitle className="text-[20px] font-bold text-[#191F28]">블로그 초안 작성</DialogTitle>
            <DialogDescription className="text-[#8B95A1] mt-1">AI가 가이드에 맞춰 초안을 작성합니다</DialogDescription>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <p className="text-[12px] font-semibold text-amber-700">
                Beta · 블로그 초안은 사용자당 하루 1회만 생성할 수 있습니다.
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="py-1 px-5 space-y-4">
              <div className="bg-white rounded-[24px] p-6 space-y-4 border border-gray-100">
                <div className="space-y-1">
                  <p className="text-[15px] font-bold text-[#191F28]">초안 옵션 설정</p>
                  <p className="text-[13px] text-[#8B95A1]">키워드와 스타일을 정하면 가이드에 맞춰 초안을 생성합니다.</p>
                </div>
                <p className="text-[14px] font-bold text-[#191F28]">키워드 설정</p>
                <div className="flex flex-wrap gap-2">
                  {draftKeywords.map((k) => (
                    <span key={k} className="inline-flex max-w-full break-all items-center gap-1 px-3 py-1.5 bg-[#F9FAFB] text-[#FF5722] rounded-full text-[13px] font-bold border border-orange-100">
                      {k} <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveKeyword(k)} />
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordInputKeyDown}
                    placeholder="해시태그 추가 후 엔터"
                    className="flex-1 h-12 bg-[#F9FAFB] border-none rounded-xl px-4 text-[14px] focus:ring-1 focus:ring-[#FF5722] outline-none"
                  />
                  <Button onClick={handleAddKeyword} variant="outline" className="h-12 rounded-xl border-gray-200 font-bold text-[#4E5968]">추가</Button>
                </div>

                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full py-4 border-t border-gray-50 mt-2 text-[14px] font-bold text-[#8B95A1] hover:text-[#4E5968]"
                >
                  <div className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> 고급 설정 (페르소나, 말투 등)</div>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
                </button>

                {showAdvanced && (
                  <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-3">
                      <p className="text-[14px] font-bold text-[#191F28]">페르소나</p>
                      <div className="flex flex-wrap gap-2">
                        {PERSONA_OPTIONS.map((p) => (
                          <button key={p.key} onClick={() => setDraftPersona(p.key)} className={cn("px-4 py-2.5 rounded-xl text-[13px] font-bold border", draftPersona === p.key ? "bg-[#FFF0E6] border-[#FF5722] text-[#FF5722]" : "bg-white border-gray-100 text-[#8B95A1]")}>{p.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-[14px] font-bold text-[#191F28]">글자수</p>
                        <div className="flex flex-wrap gap-2">
                          {LENGTH_OPTIONS.map((l) => (
                            <button key={l} onClick={() => setDraftLength(l)} className={cn("px-3 py-2 rounded-lg text-[12px] font-bold border", draftLength === l ? "bg-[#191F28] text-white" : "bg-white border-gray-100 text-[#8B95A1]")}>{l}자</button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[14px] font-bold text-[#191F28]">말투</p>
                        <div className="flex flex-wrap gap-2">
                          {TONE_OPTIONS.map((t) => (
                            <button key={t.key} onClick={() => setDraftTone(t.key)} className={cn("px-3 py-2 rounded-lg text-[12px] font-bold border", draftTone === t.key ? "bg-[#191F28] text-white" : "bg-white border-gray-100 text-[#8B95A1]")}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[14px] font-bold text-[#191F28]">강조할 내용</p>
                      <Textarea value={draftEmphasis} onChange={(e) => setDraftEmphasis(e.target.value)} placeholder="요청사항을 입력하세요." className="border-none bg-[#F9FAFB] rounded-2xl min-h-[80px] focus-visible:ring-1 focus-visible:ring-[#FF5722]" />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[24px] p-6 min-h-[260px] flex flex-col justify-center border border-gray-100 shadow-sm">
                {isGeneratingDraft ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-[#FF5722] animate-spin" />
                    <p className="text-[15px] font-medium text-[#8B95A1]">초안을 작성하고 있어요</p>
                  </div>
                ) : draftText ? (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="text-[15px] text-[#333D4B] leading-loose whitespace-pre-wrap font-medium">{draftText}</div>
                    <Button onClick={handleCopyDraft} className="w-full h-14 bg-[#F2F4F6] hover:bg-gray-200 text-[#4E5968] rounded-2xl font-bold transition-colors">
                      {copiedDraft ? <Check className="mr-2 h-4 w-4 text-[#FF5722]" /> : <Copy className="mr-2 h-4 w-4" />} 초안 복사하기
                    </Button>
                    <button
                      onClick={handleGenerateDraft}
                      disabled={!canGenerateDraftToday || isCheckingDraftQuota}
                      className="w-full text-[13px] text-[#8B95A1] underline disabled:opacity-50 disabled:no-underline"
                    >
                      {isCheckingDraftQuota
                        ? '사용 가능 여부 확인 중...'
                        : canGenerateDraftToday
                          ? '내용이 마음에 안 드시나요? 다시 만들기'
                          : '오늘은 재생성이 불가합니다'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-6 py-8">
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-[#FFF0E6] rounded-full flex items-center justify-center mx-auto">
                        <Sparkles className="w-8 h-8 text-[#FF5722] fill-[#FF5722]" />
                      </div>
                      <p className="text-[16px] font-bold text-[#191F28]">설정이 완료되었습니다</p>
                      <p className="text-[13px] text-[#8B95A1]">가이드를 분석해 블로그 글을 써드릴게요</p>
                    </div>
                    <Button 
                      onClick={handleGenerateDraft}
                      disabled={!canGenerateDraftToday || isCheckingDraftQuota}
                      className="w-full h-16 bg-[#FF5722] hover:bg-[#FF7A4C] text-white rounded-[20px] font-bold text-[17px] shadow-lg shadow-orange-100 transition-all active:scale-[0.98]"
                    >
                      {isCheckingDraftQuota
                        ? '사용 가능 여부 확인 중...'
                        : canGenerateDraftToday
                          ? '무료 초안 만들기'
                          : '오늘 사용 완료'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-4 sm:p-6 bg-white border-t border-gray-50 flex gap-3">
            <Button variant="outline" onClick={() => setIsDraftOpen(false)} className="flex-1 h-12 rounded-[22px] border-none bg-[#F2F4F6] text-[#4E5968] font-bold hover:bg-gray-200">닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
