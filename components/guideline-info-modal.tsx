'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignGuidelineAnalysis, BlogDraftOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Settings2,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';
import { formatPhoneInput } from '@/components/schedule-modal/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface GuidelineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CampaignGuidelineAnalysis | null;
  onApplyToSchedule: (analysis: CampaignGuidelineAnalysis) => void;
  platformOptions?: string[];
  reviewChannelOptions?: string[];
  categoryOptions?: string[];
  originalGuideline?: string;
  scheduleId?: number;
  userId?: string;
  initialDraftText?: string;
  initialDraftOptions?: BlogDraftOptions | null;
  onDraftGenerated?: (payload: {
    draft: string;
    options: BlogDraftOptions;
    updatedAt: string;
    analysis: CampaignGuidelineAnalysis;
  }) => void;
  openDraftOnOpen?: boolean;
  draftOnlyMode?: boolean;
  isMembershipUser?: boolean;
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
  <div className="bg-white rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 mb-4 border border-[#EEF1F4]">
    <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
      <h3 className="min-w-0 flex-1 break-words font-bold text-[18px] sm:text-[19px] text-[#191F28] tracking-tight">{title}</h3>
      {headerAction ? <div className="ml-auto shrink-0">{headerAction}</div> : null}
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

/**
 * 정보 행 컴포넌트
 */
const InfoRow = ({
  label,
  children,
  icon: Icon,
  className,
}: {
  label: string;
  children: React.ReactNode;
  icon?: any;
  className?: string;
}) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <span className="text-[13px] font-medium text-[#8B95A1] flex items-center gap-1">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
    <div className="text-[14px] text-[#333D4B] leading-relaxed font-semibold break-words">
      {children}
    </div>
  </div>
);

const DraftDisplayText = memo(function DraftDisplayText({
  text,
  isTyping,
}: {
  text: string;
  isTyping: boolean;
}) {
  return (
    <div className="min-w-0 break-words whitespace-pre-wrap text-[15px] font-medium leading-loose text-[#333D4B] transform-gpu will-change-transform">
      {text}
      {isTyping ? <span className="animate-pulse text-[#FF5722]">|</span> : null}
    </div>
  );
});

const LENGTH_OPTIONS = [500, 800, 1000, 1500, 2000, 3000] as const;
const FREE_LENGTH_OPTIONS = [500, 800, 1000] as const;
const TONE_OPTIONS = [
  { key: 'auto', label: '자동 설정' },
  { key: 'haeyo', label: '~해요' },
  { key: 'hamnida', label: '~합니다' },
  { key: 'banmal', label: '~한다' },
] as const;
const DRAFT_LOADING_STEPS = [
  '가이드라인 핵심 조건을 정리하고 있어요...',
  '선택한 말투를 반영하고 있어요...',
  '본문 흐름을 구성하고 있어요...',
  '최종 문장을 다듬고 있어요...',
] as const;
const DRAFT_EMPHASIS_MAX_LENGTH_FREE = 500;
const DRAFT_EMPHASIS_MAX_LENGTH_MEMBERSHIP = 1500;

type DraftLength = (typeof LENGTH_OPTIONS)[number];
type DraftTone = (typeof TONE_OPTIONS)[number]['key'];

function normalizeDraftLengthForFree(value: number): DraftLength {
  return FREE_LENGTH_OPTIONS.includes(value as (typeof FREE_LENGTH_OPTIONS)[number])
    ? (value as DraftLength)
    : 1000;
}

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

function parseReviewChannels(input: CampaignGuidelineAnalysis): string[] {
  if (!input.reviewChannel) return [];
  return input.reviewChannel
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeDraftOutput(input: string): string {
  return input
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*소제목\s*:\s*/gm, '')
    .replace(/(^|\s)#([^\s#]+)/g, '$1$2')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export default function GuidelineInfoModal({
  isOpen,
  onClose,
  analysis,
  onApplyToSchedule,
  platformOptions = [],
  reviewChannelOptions = [],
  categoryOptions = [],
  originalGuideline,
  scheduleId,
  userId,
  initialDraftText,
  initialDraftOptions,
  onDraftGenerated,
  openDraftOnOpen = false,
  draftOnlyMode = false,
  isMembershipUser = false,
}: GuidelineInfoModalProps) {
  const [activePanel, setActivePanel] = useState<'guideline' | 'draft'>('guideline');
  const [guidelineView, setGuidelineView] = useState<'digest' | 'original'>('digest');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isCheckingDraftQuota, setIsCheckingDraftQuota] = useState(false);
  const [canGenerateDraftToday, setCanGenerateDraftToday] = useState(true);
  const [draftText, setDraftText] = useState('');
  const [displayDraftText, setDisplayDraftText] = useState('');
  const [isTypingDraft, setIsTypingDraft] = useState(false);
  const [draftLoadingStepIndex, setDraftLoadingStepIndex] = useState(0);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [draftKeywords, setDraftKeywords] = useState<string[]>([]);
  const [draftLength, setDraftLength] = useState<DraftLength>(1000);
  const [draftTone, setDraftTone] = useState<DraftTone>('auto');
  const [draftEmphasis, setDraftEmphasis] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableAnalysis, setEditableAnalysis] = useState<CampaignGuidelineAnalysis | null>(null);
  const { toast } = useToast();
  const hasShownEmphasisLimitToastRef = useRef(false);
  const draftStreamBottomRef = useRef<HTMLDivElement | null>(null);
  const draftEmphasisMaxLength = isMembershipUser
    ? DRAFT_EMPHASIS_MAX_LENGTH_MEMBERSHIP
    : DRAFT_EMPHASIS_MAX_LENGTH_FREE;
  const isDraftEmphasisRequired = draftOnlyMode;

  const applyDraftEmphasisLimit = useCallback(
    (value: string) => {
      if (value.length <= draftEmphasisMaxLength) {
        hasShownEmphasisLimitToastRef.current = false;
        return value;
      }
      if (!hasShownEmphasisLimitToastRef.current) {
        toast({
          title: '글자 수 제한을 초과했어요',
          description: `AI가 참고할 내용은 최대 ${draftEmphasisMaxLength.toLocaleString()}자까지 입력할 수 있어요.`,
          variant: 'destructive',
        });
        hasShownEmphasisLimitToastRef.current = true;
      }
      return value.slice(0, draftEmphasisMaxLength);
    },
    [draftEmphasisMaxLength, toast]
  );

  useEffect(() => {
    if (isOpen) setGuidelineView('digest');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !analysis) return;
    setIsEditMode(false);
    setEditableAnalysis({
      ...analysis,
      reviewRegistrationPeriod: analysis.reviewRegistrationPeriod
        ? { ...analysis.reviewRegistrationPeriod }
        : undefined,
      contentRequirements: analysis.contentRequirements
        ? {
            ...analysis.contentRequirements,
            visitReviewTypes: [...(analysis.contentRequirements.visitReviewTypes ?? [])],
          }
        : analysis.contentRequirements,
    });
  }, [analysis, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftText(initialDraftText || '');
    setDisplayDraftText(initialDraftText || '');
    setIsTypingDraft(false);
    if (!initialDraftOptions) {
      setDraftLength(1000);
      setDraftTone('auto');
      setDraftEmphasis('');
      return;
    }
    setDraftLength(normalizeDraftLengthForFree(initialDraftOptions.targetLength));
    setDraftTone(initialDraftOptions.tone);
    setDraftEmphasis(applyDraftEmphasisLimit(initialDraftOptions.emphasis || ''));
    setDraftKeywords(normalizeDraftKeywords(initialDraftOptions.keywords ?? []));
  }, [applyDraftEmphasisLimit, initialDraftOptions, initialDraftText, isOpen]);

  useEffect(() => {
    setDraftEmphasis((prev) => applyDraftEmphasisLimit(prev));
  }, [applyDraftEmphasisLimit]);

  useEffect(() => {
    if (!isGeneratingDraft) return;
    setDraftLoadingStepIndex(0);
    const timer = window.setInterval(() => {
      setDraftLoadingStepIndex((prev) =>
        prev < DRAFT_LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1200);
    return () => window.clearInterval(timer);
  }, [isGeneratingDraft]);

  useEffect(() => {
    if (!isTypingDraft) {
      setDisplayDraftText(draftText);
    }
  }, [draftText, isTypingDraft]);

  useEffect(() => {
    if (!isTypingDraft) return;
    const frame = window.requestAnimationFrame(() => {
      draftStreamBottomRef.current?.scrollIntoView({ block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayDraftText, isTypingDraft]);

  useEffect(() => {
    if (!isOpen || !analysis) return;
    if (initialDraftOptions?.keywords && initialDraftOptions.keywords.length > 0) return;
    setDraftKeywords(normalizeDraftKeywords(analysis.keywords ?? []));
  }, [analysis, initialDraftOptions?.keywords, isOpen]);

  useEffect(() => {
    if (!isOpen || activePanel !== 'draft' || !userId) return;

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
        console.error('블로그 글쓰기 쿼터 조회 오류:', error);
      } finally {
        if (active) setIsCheckingDraftQuota(false);
      }
    };

    fetchQuota();
    return () => {
      active = false;
    };
  }, [activePanel, isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    setActivePanel(openDraftOnOpen || draftOnlyMode ? 'draft' : 'guideline');
    if (!openDraftOnOpen) setShowAdvanced(false);
    setCopiedDraft(false);
  }, [draftOnlyMode, isOpen, openDraftOnOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [isOpen]);

  if (!analysis) return null;
  if (!editableAnalysis) return null;

  const visitReviewTypeLabels: Record<string, string> = {
    naverReservation: '네이버 예약/영수증 리뷰',
    googleReview: '구글 리뷰',
    other: '기타 리뷰',
  };
  const effectiveAnalysis = editableAnalysis;
  const reviewChannels = parseReviewChannels(effectiveAnalysis);
  const visitReviewTypesRaw = effectiveAnalysis.contentRequirements?.visitReviewTypes ?? [];
  const visitReviewOtherText = effectiveAnalysis.contentRequirements?.visitReviewOtherText?.trim() || '';
  const visitReviewTypes = visitReviewTypesRaw.map((type) => {
    if (type === 'other' && visitReviewOtherText) {
      return `기타 리뷰 (${visitReviewOtherText})`;
    }
    return visitReviewTypeLabels[type] ?? type;
  });
  const displayPoints = effectiveAnalysis.points;
  const hasOriginalGuideline = Boolean(originalGuideline?.trim());
  const analysisKeywords = normalizeDraftKeywords(effectiveAnalysis.keywords ?? []);
  const digestSummary = (() => {
    const structured = typeof analysis.guidelineDigest?.summary === 'string'
      ? analysis.guidelineDigest.summary.trim()
      : '';
    const legacy = typeof (analysis as any).summary === 'string'
      ? String((analysis as any).summary).trim()
      : '';
    return structured || legacy;
  })();
  const digestSections = (effectiveAnalysis.guidelineDigest?.sections ?? [])
    .filter((section) => section?.title && Array.isArray(section.items) && section.items.length > 0);
  const hasTitle = Boolean(effectiveAnalysis.title?.trim());
  const hasPoints = typeof displayPoints === 'number';
  const hasEndDate = Boolean(effectiveAnalysis.reviewRegistrationPeriod?.end?.trim());
  const hasPlatform = Boolean(effectiveAnalysis.platform?.trim());
  const hasReviewChannels = reviewChannels.length > 0;
  const hasCategory = Boolean(effectiveAnalysis.category?.trim());
  const hasVisitInfo = Boolean(effectiveAnalysis.visitInfo?.trim());
  const hasPhone = Boolean(effectiveAnalysis.phone?.trim());
  const hasVisitReviewTypes = visitReviewTypes.length > 0;
  const hasCoreInfoData = [
    hasTitle,
    hasPoints,
    hasEndDate,
    hasPlatform,
    hasReviewChannels,
    hasCategory,
    hasVisitInfo,
    hasPhone,
    hasVisitReviewTypes,
  ].some(Boolean);

  const mergedPlatformOptions = Array.from(
    new Set(
      [
        ...platformOptions,
        effectiveAnalysis.platform || '',
      ].filter(Boolean)
    )
  );
  const mergedReviewChannelOptions = Array.from(
    new Set(
      [
        ...reviewChannelOptions,
        ...reviewChannels,
      ].filter(Boolean)
    )
  );
  const mergedCategoryOptions = Array.from(
    new Set(
      [
        ...categoryOptions,
        effectiveAnalysis.category || '',
      ].filter(Boolean)
    )
  );

  const updateAnalysis = (patch: Partial<CampaignGuidelineAnalysis>) => {
    setEditableAnalysis((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const toggleVisitReviewType = (value: 'naverReservation' | 'googleReview' | 'other') => {
    setEditableAnalysis((prev) => {
      if (!prev) return prev;
      const current = prev.contentRequirements?.visitReviewTypes ?? [];
      const hasValue = current.includes(value);
      const next = hasValue ? current.filter((item) => item !== value) : [...current, value];
      return {
        ...prev,
        contentRequirements: {
          ...(prev.contentRequirements ?? {}),
          visitReviewTypes: next,
          visitReviewOtherText:
            value === 'other' && hasValue
              ? null
              : prev.contentRequirements?.visitReviewOtherText ?? null,
        },
      };
    });
  };

  const toggleReviewChannel = (channel: string) => {
    setEditableAnalysis((prev) => {
      if (!prev) return prev;
      const current = parseReviewChannels(prev);
      const hasChannel = current.includes(channel);
      const nextChannels = hasChannel
        ? current.filter((item) => item !== channel)
        : [...current, channel];
      return {
        ...prev,
        reviewChannel: nextChannels.join(', ') || null,
      };
    });
  };

  const handleOpenDraftPanel = () => {
    setActivePanel('draft');
    setCopiedDraft(false);
  };

  const handleClose = () => {
    onClose();
  };

  const handleBackToGuideline = () => {
    if (draftOnlyMode) {
      onClose();
      return;
    }
    setActivePanel('guideline');
  };

  const handleGenerateDraft = async () => {
    if (isDraftEmphasisRequired && !draftEmphasis.trim()) {
      toast({
        title: 'AI가 참고할 내용을 입력해주세요',
        description: 'AI가 블로그 글을 작성할 때 참고하는 필수 항목입니다.',
        variant: 'destructive',
      });
      return;
    }

    if (draftEmphasis.trim().length > draftEmphasisMaxLength) {
      toast({
        title: '글자 수를 확인해주세요',
        description: `AI가 참고할 내용은 최대 ${draftEmphasisMaxLength.toLocaleString()}자까지 입력할 수 있어요.`,
        variant: 'destructive',
      });
      return;
    }

    if (!canGenerateDraftToday) {
      toast({
        title: '오늘 사용 완료',
        description: '블로그 글 생성은 하루 1회만 가능합니다. 내일 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingDraft(true);
    setDraftLoadingStepIndex(0);
    setCopiedDraft(false);
    setDraftText('');
    setDisplayDraftText('');
    setIsTypingDraft(false);
    const effectiveDraftLength = normalizeDraftLengthForFree(draftLength);
    const trimmedDraftEmphasis = draftEmphasis.trim();
    if (effectiveDraftLength !== draftLength) {
      setDraftLength(effectiveDraftLength);
    }
    try {
      const response = await fetch('/api/ai/generate-blog-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: effectiveAnalysis,
          userId,
          scheduleId,
          originalGuideline,
          options: {
            targetLength: effectiveDraftLength,
            tone: draftTone,
            persona: 'balanced',
            emphasis: trimmedDraftEmphasis || undefined,
            keywords: draftKeywords,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '블로그 글 생성에 실패했습니다.');
      }
      if (!response.body) {
        throw new Error('스트리밍 응답을 받을 수 없습니다. 잠시 후 다시 시도해주세요.');
      }

      const usedOptions: BlogDraftOptions = {
        targetLength: effectiveDraftLength,
        tone: draftTone,
        persona: 'balanced',
        emphasis: trimmedDraftEmphasis || undefined,
        keywords: draftKeywords,
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = '';
      let streamedDraft = '';
      let streamUpdatedAt = new Date().toISOString();
      setIsTypingDraft(true);

      const applyStreamToken = (tokenText: string) => {
        if (!tokenText) return;
        streamedDraft += tokenText;
        setDraftText((prev) => `${prev}${tokenText}`);
        setDisplayDraftText((prev) => `${prev}${tokenText}`);
      };

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let payload: any;
        try {
          payload = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (payload?.type === 'token' && typeof payload.text === 'string') {
          applyStreamToken(payload.text);
          return;
        }
        if (payload?.type === 'done') {
          if (typeof payload.updatedAt === 'string' && payload.updatedAt.trim()) {
            streamUpdatedAt = payload.updatedAt;
          }
          if (typeof payload.draft === 'string' && payload.draft.trim()) {
            const finalDraft = sanitizeDraftOutput(payload.draft);
            setDraftText(finalDraft);
            setDisplayDraftText(finalDraft);
            streamedDraft = finalDraft;
          }
          return;
        }
        if (payload?.type === 'error') {
          throw new Error(
            typeof payload.error === 'string' && payload.error.trim()
              ? payload.error
              : '블로그 글 생성 중 오류가 발생했습니다.'
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          handleLine(line);
        }
      }
      if (lineBuffer.trim()) {
        handleLine(lineBuffer);
      }

      const nextDraft = sanitizeDraftOutput(streamedDraft);
      if (!nextDraft) throw new Error('초안 결과가 비어 있습니다. 다시 시도해주세요.');
      setDraftText(nextDraft);
      setDisplayDraftText(nextDraft);
      setIsTypingDraft(false);
      setCanGenerateDraftToday(false);
      onDraftGenerated?.({
        draft: nextDraft,
        options: usedOptions,
        updatedAt: streamUpdatedAt,
        analysis: effectiveAnalysis,
      });
      toast({ title: '초안 생성 완료', description: '분석 데이터를 바탕으로 초안이 생성되었습니다.' });
    } catch (error) {
      setIsTypingDraft(false);
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
    if (!displayDraftText.trim()) return;
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

  const draftLoadingStep = DRAFT_LOADING_STEPS[draftLoadingStepIndex] ?? DRAFT_LOADING_STEPS[0];
  const draftLoadingProgress = `${Math.round(((draftLoadingStepIndex + 1) / DRAFT_LOADING_STEPS.length) * 100)}%`;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] bg-black/55 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-4"
      style={{ zIndex: Z_INDEX.guidelineAnalysisBackdrop }}
    >
      <div
        className="mx-auto flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] bg-[#EEF2F6] shadow-2xl transform-gpu sm:h-[90vh] sm:rounded-[32px]"
        style={{
          zIndex: Z_INDEX.guidelineAnalysisModal,
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
        spellCheck={false}
      >
        <div className="relative border-b border-black/5 bg-white px-4 py-3.5 sm:px-5">
          <h2 className="text-[15px] font-bold text-[#111827]">
            {activePanel === 'draft' ? 'AI 블로그 글쓰기' : '가이드라인'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-3 z-50 flex h-8 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          {!draftOnlyMode ? (
            <div className="mt-3 flex rounded-full bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => setActivePanel('guideline')}
                className={cn(
                  'h-9 flex-1 rounded-full text-[13px] font-semibold transition-colors',
                  activePanel === 'guideline' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
                )}
              >
                가이드라인
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('draft')}
                className={cn(
                  'h-9 flex-1 rounded-full text-[13px] font-semibold transition-colors',
                  activePanel === 'draft' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
                )}
              >
                블로그 초안
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {activePanel === 'guideline' ? (
            <div className="space-y-4 px-3 pb-20 sm:px-5">
              {hasCoreInfoData && (
                <SectionCard
                  title="핵심 정보"
                  headerAction={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditMode((prev) => !prev)}
                      className="h-8.5 rounded-full text-[12px] font-bold text-[#4E5968] bg-white hover:bg-[#F9FAFB] transition-colors"
                    >
                      {isEditMode ? '수정 완료' : '수정하기'}
                    </Button>
                  }
                >
                  <div className={cn('gap-y-4 gap-x-4', isEditMode ? 'grid grid-cols-1' : 'grid grid-cols-2 md:grid-cols-4')}>
                    {(isEditMode || hasTitle) && (
                      <InfoRow label="제목">
                        {isEditMode ? (
                          <Input
                            value={effectiveAnalysis.title || ''}
                            spellCheck={false}
                            onChange={(e) =>
                              setEditableAnalysis((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      title: e.target.value,
                                    }
                                  : prev
                              )
                            }
                            className="h-10 w-full text-[13px] font-semibold"
                            placeholder="캠페인 제목"
                          />
                        ) : (
                          effectiveAnalysis.title || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasPoints) && (
                      <InfoRow label="금액">
                        {isEditMode ? (
                          <Input
                            value={hasPoints ? displayPoints.toLocaleString() : ''}
                            spellCheck={false}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^0-9]/g, '');
                              const next = digits ? Number(digits) : null;
                              setEditableAnalysis((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      points: next,
                                    }
                                  : prev
                              );
                            }}
                            className="h-10 w-full text-[13px] font-semibold"
                            placeholder="숫자만"
                          />
                        ) : (
                          <span className="text-[#FF5722] font-bold">
                            {hasPoints ? `${displayPoints.toLocaleString()}P` : '-'}
                          </span>
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasEndDate) && (
                      <InfoRow label="마감일">
                        {isEditMode ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 w-full justify-start px-3 text-[13px] font-semibold"
                              >
                                {effectiveAnalysis.reviewRegistrationPeriod?.end
                                  ? format(new Date(effectiveAnalysis.reviewRegistrationPeriod.end), 'PPP', {
                                      locale: ko,
                                    })
                                  : '날짜 선택'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                              style={{ zIndex: Z_INDEX.guidelineAnalysisModal + 20 }}
                            >
                              <CalendarPicker
                                mode="single"
                                selected={
                                  effectiveAnalysis.reviewRegistrationPeriod?.end
                                    ? new Date(effectiveAnalysis.reviewRegistrationPeriod.end)
                                    : undefined
                                }
                                onSelect={(date) =>
                                  setEditableAnalysis((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          reviewRegistrationPeriod: {
                                            ...(prev.reviewRegistrationPeriod ?? {}),
                                            end: date ? format(date, 'yyyy-MM-dd') : null,
                                          },
                                        }
                                      : prev
                                  )
                                }
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          effectiveAnalysis.reviewRegistrationPeriod?.end || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasPlatform) && (
                      <InfoRow label="플랫폼">
                        {isEditMode ? (
                          <Select
                            value={effectiveAnalysis.platform || '__none'}
                            onValueChange={(value) => updateAnalysis({ platform: value === '__none' ? null : value })}
                          >
                            <SelectTrigger className="h-10 w-full text-[13px] font-semibold">
                              <SelectValue placeholder="선택 안 함" />
                            </SelectTrigger>
                            <SelectContent style={{ zIndex: Z_INDEX.guidelineAnalysisModal + 10 }}>
                              <SelectItem value="__none">선택 안 함</SelectItem>
                              {mergedPlatformOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          effectiveAnalysis.platform || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasReviewChannels) && (
                      <InfoRow label="리뷰 채널" className={isEditMode ? 'md:col-span-1' : ''}>
                        {isEditMode ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {mergedReviewChannelOptions.map((option) => (
                              <label
                                key={option}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 min-w-0"
                              >
                                <Checkbox
                                  checked={reviewChannels.includes(option)}
                                  onCheckedChange={() => toggleReviewChannel(option)}
                                />
                                <span className="text-[12px] font-semibold text-[#4E5968] break-keep">{option}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          reviewChannels.join(', ') || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasCategory) && (
                      <InfoRow label="카테고리">
                        {isEditMode ? (
                          <Select
                            value={effectiveAnalysis.category || '__none'}
                            onValueChange={(value) => updateAnalysis({ category: value === '__none' ? null : value })}
                          >
                            <SelectTrigger className="h-10 w-full text-[13px] font-semibold">
                              <SelectValue placeholder="선택 안 함" />
                            </SelectTrigger>
                            <SelectContent style={{ zIndex: Z_INDEX.guidelineAnalysisModal + 10 }}>
                              <SelectItem value="__none">선택 안 함</SelectItem>
                              {mergedCategoryOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          effectiveAnalysis.category || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasVisitInfo) && (
                      <InfoRow label="방문 정보">
                        {isEditMode ? (
                          <Input
                            type="text"
                            value={effectiveAnalysis.visitInfo || ''}
                            spellCheck={false}
                            onChange={(e) => updateAnalysis({ visitInfo: e.target.value || null })}
                            className="h-10 w-full text-[13px] font-semibold"
                            placeholder="방문 위치/안내 정보"
                          />
                        ) : (
                          effectiveAnalysis.visitInfo || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasPhone) && (
                      <InfoRow label="전화번호">
                        {isEditMode ? (
                          <Input
                            type="text"
                            value={effectiveAnalysis.phone || ''}
                            spellCheck={false}
                            onChange={(e) => updateAnalysis({ phone: formatPhoneInput(e.target.value) || null })}
                            className="h-10 w-full text-[13px] font-semibold"
                            placeholder="010-0000-0000"
                          />
                        ) : (
                          effectiveAnalysis.phone || '-'
                        )}
                      </InfoRow>
                    )}
                    {(isEditMode || hasVisitReviewTypes) && (
                      <InfoRow label="방문 리뷰 항목" className={isEditMode ? 'md:col-span-1' : ''}>
                        {isEditMode ? (
                          <div className="space-y-2">
                            {(['naverReservation', 'googleReview', 'other'] as const).map((type) => {
                              const selected = visitReviewTypesRaw.includes(type);
                              return (
                                <label
                                  key={type}
                                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2"
                                >
                                  <Checkbox checked={selected} onCheckedChange={() => toggleVisitReviewType(type)} />
                                  <span className="text-[12px] font-semibold text-[#4E5968]">
                                    {visitReviewTypeLabels[type]}
                                  </span>
                                </label>
                              );
                            })}
                            {visitReviewTypesRaw.includes('other') && (
                              <Input
                                value={visitReviewOtherText}
                                spellCheck={false}
                                onChange={(e) =>
                                  setEditableAnalysis((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          contentRequirements: {
                                            ...(prev.contentRequirements ?? {}),
                                            visitReviewTypes: prev.contentRequirements?.visitReviewTypes ?? ['other'],
                                            visitReviewOtherText: e.target.value || null,
                                          },
                                        }
                                      : prev
                                  )
                                }
                                className="h-10 w-full text-[13px] font-semibold"
                                placeholder="기타 리뷰 항목 입력"
                              />
                            )}
                          </div>
                        ) : (
                          visitReviewTypes.join(', ') || '-'
                        )}
                      </InfoRow>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onApplyToSchedule(effectiveAnalysis)}
                    className="w-full h-[44px] bg-[#FFF0E6] text-[#FF5722] rounded-[16px] text-[14px] font-bold flex items-center justify-center gap-1 hover:bg-[#FFE8D9] transition-all active:scale-[0.98]"
                  >
                    내 일정에 반영하기 <ChevronRight className="w-5 h-5" />
                  </Button>
                </SectionCard>
              )}

              <SectionCard
                title="가이드라인"
                headerAction={
                  <button
                    onClick={handleOpenDraftPanel}
                    className="mt-1 h-10 text-[13px] font-bold text-[#FF5722] inline-flex items-center justify-center gap-1.5 px-4 bg-white border border-[#FFD7C2] rounded-full hover:bg-[#FFF7F2] shadow-sm transition-colors"
                  >
                    <Sparkles className="w-2.5 h-2.5 fill-[#FF5722]" /> 블로그 글쓰기
                  </button>
                }
              >
                <div className="flex bg-[#F2F4F6] p-1.5 rounded-[14px] border border-gray-100">
                  {['digest', 'original'].map((v) => (
                    <button
                      key={v}
                      className={cn(
                        'flex-1 h-10 text-[14px] font-bold rounded-[10px] transition-all',
                        guidelineView === v ? 'bg-white text-[#191F28] shadow-sm border border-gray-100' : 'text-[#8B95A1]'
                      )}
                      onClick={() => setGuidelineView(v as 'digest' | 'original')}
                    >
                      {v === 'digest' ? '가이드 정리' : '원본 보기'}
                    </button>
                  ))}
                </div>
                {guidelineView === 'digest' ? (
                  <div className="space-y-6">
                    {analysisKeywords.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[15px] font-bold text-[#4E5968]">키워드</p>
                          <button onClick={handleCopyKeywords} className="text-[12px] text-[#8B95A1] flex items-center gap-1">
                            {copiedKeywords ? <Check className="w-3 h-3 text-[#FF5722]" /> : <Copy className="w-3 h-3" />} 복사
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {analysisKeywords.map((k) => (
                            <span
                              key={k}
                              className="max-w-full break-all px-3 py-1.5 bg-[#F9FAFB] text-[#4E5968] rounded-full text-[13px] font-medium border border-gray-100"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {digestSections.map((s, i) => (
                      <div key={i} className="space-y-3">
                        <p className="text-[15px] font-bold text-[#191F28]">{s.title}</p>
                        <ul className="space-y-2">
                          {s.items.map((item, j) => (
                            <li
                              key={j}
                              className="flex gap-2.5 items-start text-[14px] text-[#4E5968] bg-[#FCFCFD] border border-gray-100 rounded-xl px-3 py-2.5"
                            >
                              <CheckCircle2 className="mt-0.5 w-4 h-4 text-[#FF5722] shrink-0" />
                              <span className="min-w-0 flex-1 break-all leading-relaxed">{item}</span>
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
          ) : (
            <div className="w-full min-w-0 overflow-x-hidden pt-0 pb-4 px-4 sm:px-5 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="w-full min-w-0 bg-white rounded-[24px] p-6 space-y-3 border border-gray-100">
                <p className="text-[14px] font-bold text-[#191F28]">키워드 설정</p>
                {draftKeywords.length > 0 && (
                  <div className="min-h-[48px] max-h-[180px] overflow-y-auto overscroll-contain rounded-xl bg-[#F9FAFB] border border-dashed border-gray-200 px-3 py-2 flex flex-wrap content-start items-center gap-2">
                    {draftKeywords.map((k) => (
                      <span key={k} className="inline-flex w-fit max-w-full min-w-0 items-center gap-1 px-3 py-1.5 bg-white text-[#FF5722] rounded-full text-[13px] font-bold border border-orange-100">
                        <span className="min-w-0 break-all whitespace-normal">{k}</span>
                        <X className="w-3 h-3 shrink-0 cursor-pointer" onClick={() => handleRemoveKeyword(k)} />
                      </span>
                    ))}
                  </div>
                )}
                <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row">
                  <input
                    value={keywordInput}
                    spellCheck={false}
                    autoCorrect="off"
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordInputKeyDown}
                    placeholder="해시태그 추가 후 엔터"
                    className="h-12 w-full min-w-0 bg-[#F9FAFB] border-none rounded-xl px-4 text-[16px] sm:text-[14px] focus:ring-1 focus:ring-[#FF5722] outline-none"
                  />
                  <Button onClick={handleAddKeyword} variant="outline" className="h-12 w-full rounded-xl border-gray-200 font-bold text-[#4E5968] sm:w-auto sm:shrink-0">
                    추가
                  </Button>
                </div>
                <div className="space-y-3 pt-1">
                  <p className="text-[14px] font-bold text-[#191F28]">
                    AI가 참고할 내용{' '}
                    <span className={cn(isDraftEmphasisRequired ? 'text-[#FF5722]' : 'text-[#8B95A1]')}>
                      ({isDraftEmphasisRequired ? '필수' : '선택'})
                    </span>
                  </p>
                  <Textarea
                    value={draftEmphasis}
                    spellCheck={false}
                    onChange={(e) => setDraftEmphasis(applyDraftEmphasisLimit(e.target.value))}
                    placeholder="예: 제품 차별점, 꼭 언급할 기능/성분, 20대 여성 대상임을 강조 등"
                    className="border-none bg-[#F9FAFB] rounded-2xl min-h-[100px] focus-visible:ring-1 focus-visible:ring-[#FF5722]"
                  />
                  <div className="flex items-center justify-between text-[12px] text-[#8B95A1]">
                    <span>최대 500자, 멤버십 최대 1,500자</span>
                    <span className={cn(draftEmphasis.length >= draftEmphasisMaxLength && 'text-[#FF5722]')}>
                      {draftEmphasis.length.toLocaleString()} / {draftEmphasisMaxLength.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full py-4 border-t border-gray-50 mt-2 text-[14px] font-bold text-[#4E5968]"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> 고급 설정 (말투, 글자수 등)
                  </div>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
                </button>
                {showAdvanced && (
                  <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-[14px] font-bold text-[#191F28]">글자수</p>
                        <div className="flex flex-wrap gap-2">
                          {LENGTH_OPTIONS.map((l) => {
                            const isProLocked = l >= 1500;
                            return (
                              <button
                                key={l}
                                onClick={() => {
                                  if (!isProLocked) setDraftLength(l);
                                }}
                                disabled={isProLocked}
                                className={cn(
                                  'px-3 py-2 rounded-lg text-[12px] font-bold border inline-flex items-center gap-1.5',
                                  draftLength === l ? 'bg-[#191F28] text-white' : 'bg-white border-gray-100 text-[#8B95A1]',
                                  isProLocked && 'opacity-55 cursor-not-allowed bg-gray-50 text-[#B0B8C1]'
                                )}
                              >
                                {l}자
                                {isProLocked && (
                                  <span
                                    className="inline-flex items-center justify-center text-[12px] leading-none"
                                    aria-label="프로 전용"
                                    title="PRO 전용"
                                  >
                                    👑
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[14px] font-bold text-[#191F28]">말투</p>
                        <div className="flex flex-wrap gap-2">
                          {TONE_OPTIONS.map((t) => (
                            <button
                              key={t.key}
                              onClick={() => setDraftTone(t.key)}
                              className={cn(
                                'px-3 py-2 rounded-lg text-[12px] font-bold border',
                                draftTone === t.key ? 'bg-[#191F28] text-white' : 'bg-white border-gray-100 text-[#8B95A1]'
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {draftText ? (
                <div className="w-full min-w-0 bg-white rounded-[24px] p-6 flex flex-col justify-center border border-gray-100 shadow-sm">
                  <div className="space-y-4 animate-in fade-in">
                    <DraftDisplayText text={displayDraftText} isTyping={isTypingDraft} />
                    <Button
                      onClick={handleCopyDraft}
                      disabled={isGeneratingDraft}
                      className="w-full h-14 bg-[#F2F4F6] hover:bg-gray-200 text-[#4E5968] rounded-2xl font-bold transition-colors"
                    >
                      {copiedDraft ? <Check className="mr-2 h-4 w-4 text-[#FF5722]" /> : <Copy className="mr-2 h-4 w-4" />} 초안 복사하기
                    </Button>
                    <button
                      onClick={handleGenerateDraft}
                      disabled={!canGenerateDraftToday || isCheckingDraftQuota || isGeneratingDraft}
                      className="w-full text-[13px] text-[#8B95A1] underline disabled:opacity-50 disabled:no-underline"
                    >
                      {isGeneratingDraft
                        ? '초안 출력 중...'
                        : isCheckingDraftQuota
                          ? '사용 가능 여부 확인 중...'
                          : canGenerateDraftToday
                            ? '내용이 마음에 안 드시나요? 다시 만들기'
                            : 'Beta · 하루 1회만 생성할 수 있습니다.'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7ED] p-6 text-center">
                  {isGeneratingDraft ? (
                    <div className="space-y-2">
                      <p className="text-[13px] font-semibold text-[#9A3412]">{draftLoadingStep}</p>
                      <p className="text-[12px] text-[#C2410C]">{draftLoadingProgress}</p>
                    </div>
                  ) : (
                    <Button
                      onClick={handleGenerateDraft}
                      disabled={
                        !canGenerateDraftToday ||
                        isCheckingDraftQuota ||
                        isGeneratingDraft ||
                        (isDraftEmphasisRequired && !draftEmphasis.trim())
                      }
                      className="w-full h-11 bg-[#FF5722] hover:bg-[#FF7A4C] text-white rounded-[16px] font-bold text-[14px]"
                    >
                      {isCheckingDraftQuota
                        ? '사용 가능 여부 확인 중...'
                        : canGenerateDraftToday
                          ? '블로그 글 생성'
                          : '하루 1회만 가능해요. 내일 다시 시도해주세요'}
                    </Button>
                  )}
                </div>
              )}
              <div ref={draftStreamBottomRef} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
