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

export default function GuidelineAnalysisModal({
  isOpen,
  onClose,
  onApply,
}: GuidelineAnalysisModalProps) {
  const [guideline, setGuideline] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CampaignGuidelineAnalysis | null>(null);
  const [copied, setCopied] = useState(false);
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
      setAnalysis(result.data);
      toast({
        title: '성공',
        description: '가이드라인이 분석되었습니다',
      });
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (analysis) {
      onApply(analysis);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/50 flex items-center justify-center" style={{ zIndex: Z_INDEX.guidelineAnalysisBackdrop }}>
      <div className="bg-white rounded-xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: Z_INDEX.guidelineAnalysisModal }}>
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">캠페인 가이드라인 분석</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
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
                💡 팁: 전체 가이드라인 텍스트를 복사해서 붙여넣으면 정확한 분석이 가능합니다
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">📋 기본 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-600">제목</p>
                    <p className="font-medium">{analysis.title || '-'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600">포인트</p>
                    <p className="font-medium">{analysis.points ? analysis.points.toLocaleString() : '-'}P</p>
                  </div>
                  <div>
                    <p className="text-neutral-600">모집기간</p>
                    <p className="font-medium">
                      {analysis.recruitPeriod?.start || '-'} ~ {analysis.recruitPeriod?.end || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-600">리뷰 등록기간</p>
                    <p className="font-medium">
                      {analysis.reviewRegistrationPeriod?.start || '-'} ~ {analysis.reviewRegistrationPeriod?.end || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 보상정보 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">💰 보상정보</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-neutral-600">포인트:</span>
                    <span className="font-medium ml-2">{analysis.rewardInfo?.points ? analysis.rewardInfo.points.toLocaleString() : '-'}P</span>
                  </p>
                  <p>
                    <span className="text-neutral-600">배송:</span>
                    <span className="font-medium ml-2">{analysis.rewardInfo?.deliveryMethod || '-'}</span>
                  </p>
                  {analysis.rewardInfo?.productInfo && (
                    <p>
                      <span className="text-neutral-600">제품:</span>
                      <span className="font-medium ml-2">{analysis.rewardInfo.productInfo}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 컨텐츠 요구사항 */}
              <div className="bg-orange-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">📝 컨텐츠 요구사항</h3>
                <div className="space-y-3 text-sm">
                  {analysis.contentRequirements?.titleKeywords && analysis.contentRequirements.titleKeywords.length > 0 && (
                    <div>
                      <p className="font-medium text-neutral-700 mb-1">제목 키워드</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.contentRequirements.titleKeywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-white border border-orange-200 rounded text-orange-700 text-xs"
                          >
                            {kw.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.contentRequirements?.bodyKeywords && analysis.contentRequirements.bodyKeywords.length > 0 && (
                    <div>
                      <p className="font-medium text-neutral-700 mb-1">본문 키워드</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.contentRequirements.bodyKeywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-white border border-orange-200 rounded text-orange-700 text-xs"
                          >
                            {kw.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.contentRequirements?.requirements && analysis.contentRequirements.requirements.length > 0 && (
                    <div>
                      <p className="font-medium text-neutral-700 mb-1">요구사항</p>
                      {analysis.contentRequirements.requirements.map((req, idx) => (
                        <p key={idx} className="text-neutral-600 text-xs">
                          • {req.label}: {req.value}
                          {req.description ? ` (${req.description})` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 미션 세부사항 */}
              {analysis.missions && analysis.missions.length > 0 && (
                <div className="bg-pink-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">🎯 미션 세부사항</h3>
                  <div className="space-y-3 text-sm">
                    {analysis.missions.map((mission, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-pink-200">
                        <p className="font-medium text-neutral-800">{mission.title || '-'}</p>
                        <p className="text-neutral-600 mt-1">{mission.description || '-'}</p>
                        {mission.examples && mission.examples.length > 0 && (
                          <ul className="mt-2 ml-4 text-xs text-neutral-600 list-disc">
                            {mission.examples.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 주의사항 */}
              {analysis.warnings && analysis.warnings.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">⚠️ 주의사항</h3>
                  <ul className="space-y-1 text-sm text-red-700 list-disc list-inside">
                    {analysis.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-2 justify-end bg-neutral-50">
          {analysis && (
            <Button
              variant="outline"
              onClick={handleCopyJson}
              className="flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'JSON 복사됨' : 'JSON 복사'}
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
