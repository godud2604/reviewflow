'use client';

import { useState } from 'react';
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
  onApply: (analysis: CampaignGuidelineAnalysis) => void;
}

export default function GuidelineAnalysisModal({
  isOpen,
  onClose,
  onApply,
}: GuidelineAnalysisModalProps) {
  const [guideline, setGuideline] = useState('');
  const [loading, setLoading] = useState(false);
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
         
          </div>
        </div>

        <div className="border-t px-6 py-4 flex gap-2 justify-end bg-neutral-50">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleAnalyze} disabled={loading} className="flex items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? '분석 중...' : '분석하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
