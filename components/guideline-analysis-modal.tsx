'use client';

import { useEffect, useRef, useState } from 'react';
import type { CampaignGuidelineAnalysis } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, BookOpen, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

interface GuidelineAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (analysis: CampaignGuidelineAnalysis, originalGuideline: string) => void;
  scheduleId?: number;
}

const MAX_GUIDELINE_LENGTH = 1500;
const ANALYSIS_LOADING_STEPS = [
  '가이드라인 내용을 꼼꼼히 읽고 있어요',
  '꼭 지켜야 할 조건들을 찾고 있어요',
  '중요한 키워드만 쏙쏙 뽑아내고 있어요',
  '일정에 바로 반영할 수 있게 정리 중이에요',
] as const;

export default function GuidelineAnalysisModal({
  isOpen,
  onClose,
  onApply,
  scheduleId,
}: GuidelineAnalysisModalProps) {
  const [guideline, setGuideline] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [canAnalyzeToday, setCanAnalyzeToday] = useState(true);
  const hasShownLimitToastRef = useRef(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen || !user?.id) return;

    let active = true;
    const fetchQuota = async () => {
      setQuotaLoading(true);
      try {
        const response = await fetch(`/api/ai/quota-status?userId=${encodeURIComponent(user.id)}`);
        if (!response.ok) {
          if (active) setCanAnalyzeToday(true);
          return;
        }
        const result = await response.json();
        if (!active) return;
        setCanAnalyzeToday(Boolean(result?.data?.guideline?.allowed));
      } catch (error) {
        if (active) setCanAnalyzeToday(true);
        console.error('가이드라인 쿼터 조회 오류:', error);
      } finally {
        if (active) setQuotaLoading(false);
      }
    };

    fetchQuota();
    return () => { active = false; };
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!loading) return;
    setAnalysisStepIndex(0);
    const timer = window.setInterval(() => {
      setAnalysisStepIndex((prev) =>
        prev < ANALYSIS_LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const handleGuidelineChange = (value: string) => {
    if (value.length > MAX_GUIDELINE_LENGTH) {
      if (!hasShownLimitToastRef.current) {
        toast({
          title: '글자 수가 너무 많아요',
          description: `${MAX_GUIDELINE_LENGTH}자까지만 분석할 수 있어요.`,
          variant: 'destructive',
        });
        hasShownLimitToastRef.current = true;
      }
      setGuideline(value.slice(0, MAX_GUIDELINE_LENGTH));
      return;
    }
    hasShownLimitToastRef.current = false;
    setGuideline(value);
  };

  const handleAnalyze = async () => {
    if (!guideline.trim()) return;
    if (!canAnalyzeToday) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/parse-guideline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideline, userId: user?.id, scheduleId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '잠시 후 다시 시도해주세요.');
      }

      const result = await response.json();
      onApply(result.data, guideline.trim());
      onClose();
    } catch (error) {
      toast({
        title: '분석하지 못했어요',
        description: error instanceof Error ? error.message : '네트워크 상태를 확인해주세요.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentStep = ANALYSIS_LOADING_STEPS[analysisStepIndex];
  const progressPercent = ((analysisStepIndex + 1) / ANALYSIS_LOADING_STEPS.length) * 100;
  const isLimitReached = guideline.length >= MAX_GUIDELINE_LENGTH;

  return (
    <div 
      className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: Z_INDEX.guidelineAnalysisBackdrop }}
    >
      <div 
        className="bg-white rounded-[24px] w-full max-w-lg max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{ zIndex: Z_INDEX.guidelineAnalysisModal }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500 fill-blue-50" />
            <h2 className="text-[16px] font-bold text-neutral-900">AI 가이드라인 분석</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
          {/* Toss Style Info Cards */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 rounded-[16px] bg-blue-50/50 px-4 py-3.5">
              <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="text-[13px] leading-tight">
                <span className="font-semibold text-blue-900 mr-1.5">베타 서비스</span>
                <span className="text-blue-700/80">하루에 한 번만 쓸 수 있어요.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-[16px] bg-neutral-50 px-4 py-3.5">
              <BookOpen className="w-4 h-4 text-neutral-500 shrink-0" />
              <span className="text-[13px] font-medium text-neutral-600 leading-tight">가이드라인 본문을 그대로 복사해서 붙여넣어 주세요.</span>
            </div>
          </div>

          {/* Textarea Section with Margin Bottom */}
          <div className="space-y-3 mb-4"> {/* margin-bottom 추가하여 아래 요소와 간격 확보 */}
            <label className="text-[14px] font-bold text-neutral-800 px-0.5">가이드라인 본문</label>
            <div className="mt-2 relative group border border-neutral-200 rounded-[20px] overflow-hidden bg-white focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200 transition-all duration-200">
              <Textarea
                value={guideline}
                onChange={(e) => handleGuidelineChange(e.target.value)}
                placeholder="브랜드명, 필수 키워드, 마감일 등 전체 내용을 적어주세요."
                className={cn(
                  "min-h-[260px] max-h-[360px] p-5 pb-16 text-[15px] leading-relaxed border-none focus-visible:ring-0 resize-none overflow-y-auto placeholder:text-neutral-300",
                  isLimitReached && "bg-red-50/10"
                )}
                disabled={loading}
              />
              {/* Floating Counter */}
              <div className="absolute bottom-4 right-5 pointer-events-none">
                <div 
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[14px] font-bold transition-all border bg-white/90 backdrop-blur-sm pointer-events-auto shadow-sm",
                    isLimitReached ? "text-red-500 border-red-100" : "text-neutral-400 border-neutral-100"
                  )}
                >
                  {guideline.length.toLocaleString()} <span className="mx-0.5 text-neutral-200 font-normal">/</span> {MAX_GUIDELINE_LENGTH.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message - Space Inside Scroll Area */}
          {!canAnalyzeToday && !loading && (
            <div className="flex items-start gap-2 p-4 rounded-[16px] bg-red-50 text-red-600 border border-red-100 animate-in fade-in slide-in-from-top-1 mb-6">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="text-[12px] font-semibold leading-relaxed">
                오늘은 이미 사용하셨네요. 내일 다시 시도해주세요!
              </span>
            </div>
          )}

          {/* Loading View */}
          {loading && (
            <div className="rounded-[20px] border border-blue-100 bg-blue-50/30 p-5 space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <p className="text-[13px] font-bold text-blue-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentStep}
                </p>
                <span className="text-[11px] font-black text-blue-500">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-100/50 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed Bottom */}
        <div className="px-6 py-5 border-t border-neutral-50 bg-white flex justify-end gap-3 shrink-0">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-neutral-500 h-12 px-6 text-[15px] font-medium hover:bg-neutral-50 rounded-[12px]"
          >
            취소
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={loading || quotaLoading || !canAnalyzeToday || !guideline.trim()}
            className="min-w-[140px] h-12 rounded-[12px] text-[15px] font-bold shadow-none bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {loading ? '분석하는 중...' : '분석하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}