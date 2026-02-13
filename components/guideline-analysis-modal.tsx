'use client';

import { useEffect, useState } from 'react';
import type { CampaignGuidelineAnalysis } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Z_INDEX } from '@/lib/z-index';

interface GuidelineAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (analysis: CampaignGuidelineAnalysis, originalGuideline: string) => void;
  scheduleId?: number;
}

export default function GuidelineAnalysisModal({
  isOpen,
  onClose,
  onApply,
  scheduleId,
}: GuidelineAnalysisModalProps) {
  const [guideline, setGuideline] = useState('');
  const [loading, setLoading] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [canAnalyzeToday, setCanAnalyzeToday] = useState(true);
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
    return () => {
      active = false;
    };
  }, [isOpen, user?.id]);

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

    if (!canAnalyzeToday) {
      toast({
        title: '오늘 사용 완료',
        description: '가이드라인 분석은 하루 1회만 가능합니다. 내일 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/parse-guideline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideline, userId: user.id, scheduleId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || '가이드라인 분석 실패');
      }

      const result = await response.json();
      const analysisData = result.data;
      
      toast({
        title: '성공',
        description: '가이드라인이 분석되었습니다',
      });
      
      // 분석 완료 후 결과와 원본 텍스트 전달
      onApply(analysisData, guideline.trim());
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

  if (!isOpen) return null;

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
          <div className="p-6 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[12px] font-semibold text-amber-700">
                Beta · 가이드라인 분석은 사용자당 하루 1회만 가능합니다.
              </p>
            </div>
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
            {!canAnalyzeToday && (
              <p className="text-[12px] font-medium text-red-500">
                오늘은 이미 분석을 실행했습니다. 내일 다시 시도해주세요.
              </p>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex gap-2 justify-end bg-neutral-50">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={loading || quotaLoading || !canAnalyzeToday}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? '분석 중...' : quotaLoading ? '확인 중...' : canAnalyzeToday ? '분석하기' : '오늘 사용 완료'}
          </Button>
        </div>
      </div>
    </div>
  );
}
