'use client';

import type { CampaignGuidelineAnalysis } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Z_INDEX } from '@/lib/z-index';

interface GuidelineInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CampaignGuidelineAnalysis | null;
}

export default function GuidelineInfoModal({
  isOpen,
  onClose,
  analysis,
}: GuidelineInfoModalProps) {
  if (!analysis) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ zIndex: Z_INDEX.guidelineAnalysisModal }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{analysis.title || 'n/a'} - 캠페인 가이드라인</DialogTitle>
          <DialogDescription>
            {analysis.points ? analysis.points.toLocaleString() : '0'}P | 모집기간: {analysis.recruitPeriod?.start || ''} ~{' '}
            {analysis.recruitPeriod?.end || ''}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full">
          <Tabs defaultValue="reward" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-4">
              <TabsTrigger value="reward">보상정보</TabsTrigger>
              <TabsTrigger value="content">컨텐츠 요구사항</TabsTrigger>
              <TabsTrigger value="missions">미션</TabsTrigger>
              <TabsTrigger value="notices">필수 공지</TabsTrigger>
              <TabsTrigger value="important">중요사항</TabsTrigger>
              <TabsTrigger value="warnings">주의사항</TabsTrigger>
            </TabsList>

            {/* 보상정보 */}
            <TabsContent value="reward" className="p-4 space-y-4">
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">지급 포인트</h3>
                <p className="text-lg font-bold text-purple-600">
                  {analysis.rewardInfo?.points ? analysis.rewardInfo.points.toLocaleString() : '0'}P
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">배송 방법</h3>
                <p className="text-neutral-700">{analysis.rewardInfo?.deliveryMethod || '-'}</p>
              </div>

              {analysis.rewardInfo?.productInfo && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">제공 내역</h3>
                  <p className="text-neutral-700">{analysis.rewardInfo.productInfo}</p>
                </div>
              )}

              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-3">상세 설명</h3>
                <p className="text-neutral-700 text-sm whitespace-pre-wrap">
                  {analysis.rewardInfo?.description || '-'}
                </p>
              </div>
            </TabsContent>

            {/* 컨텐츠 요구사항 */}
            <TabsContent value="content" className="p-4 space-y-4">
              {analysis.contentRequirements?.titleKeywords && analysis.contentRequirements.titleKeywords.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">제목 키워드</h3>
                  <p className="text-sm text-neutral-600 mb-2">다음 중 1개를 선택하여 제목에 포함하세요</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.contentRequirements.titleKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-white border border-orange-300 rounded-full text-sm font-medium text-orange-700"
                      >
                        {kw.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.contentRequirements?.bodyKeywords && analysis.contentRequirements.bodyKeywords.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">본문 키워드</h3>
                  <p className="text-sm text-neutral-600 mb-2">
                    다음 중 1개를 선택하여 본문에 4번 이상 포함하세요
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.contentRequirements.bodyKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-white border border-orange-300 rounded-full text-sm font-medium text-orange-700"
                      >
                        {kw.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.contentRequirements?.requirements && analysis.contentRequirements.requirements.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-neutral-800 mb-3">필수 요구사항</h3>
                  <div className="space-y-2">
                    {analysis.contentRequirements.requirements.map((req, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-orange-200 last:border-0">
                        <span className="text-neutral-700">{req.label}</span>
                        <span className="font-bold text-orange-600">
                          {req.type === 'length' ? `${req.value}자 이상` : req.value}
                          {req.type === 'image' && '장'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 미션 */}
            <TabsContent value="missions" className="p-4 space-y-4">
              {analysis.missions && analysis.missions.length > 0 ? (
                analysis.missions.map((mission, idx) => (
                  <div key={idx} className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                    <h4 className="font-semibold text-neutral-800 mb-2">미션 {idx + 1}: {mission.title || '-'}</h4>
                    <p className="text-neutral-700 text-sm mb-3">{mission.description || '-'}</p>
                    {mission.examples && mission.examples.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-600 mb-2">예시:</p>
                        <ul className="space-y-1">
                          {mission.examples.map((example, i) => (
                            <li key={i} className="text-xs text-neutral-600 flex items-start gap-2">
                              <span className="text-pink-500 mt-1">•</span>
                              <span>{example}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 text-sm">미션 정보가 없습니다</p>
              )}
            </TabsContent>

            {/* 필수 공지 문구 */}
            <TabsContent value="notices" className="p-4 space-y-4">
              {analysis.requiredNotices && analysis.requiredNotices.length > 0 ? (
                <>
                  {analysis.requiredNotices.map((notice, idx) => (
                    <div
                      key={idx}
                      className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400 text-sm text-neutral-700"
                    >
                      <p className="font-medium text-blue-900 mb-1">✓ 필수 공지 {idx + 1}</p>
                      <p className="text-neutral-700">{notice}</p>
                    </div>
                  ))}
                  <div className="bg-blue-100 rounded-lg p-3 text-xs text-blue-900 border border-blue-300">
                    <p className="font-semibold mb-1">💡 팁</p>
                    <p>
                      이 문구들은 리뷰 작성 시 반드시 포함되어야 합니다. 특히 공정위 관련 대가성 문구는 리뷰
                      상단에 기재해야 합니다.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-neutral-400 text-sm">필수 공지 정보가 없습니다</p>
              )}
            </TabsContent>

            {/* 중요사항 */}
            <TabsContent value="important" className="p-4 space-y-3">
              {analysis.importantNotes && analysis.importantNotes.length > 0 ? (
                analysis.importantNotes.map((note, idx) => (
                  <div key={idx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-neutral-700 text-sm flex items-start gap-2">
                      <span className="text-green-600 font-bold text-lg leading-none mt-0.5">✓</span>
                      <span>{note}</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 text-sm">중요사항이 없습니다</p>
              )}
            </TabsContent>

            {/* 주의사항 */}
            <TabsContent value="warnings" className="p-4 space-y-3">
              {analysis.warnings && analysis.warnings.length > 0 ? (
                analysis.warnings.map((warning, idx) => (
                  <div key={idx} className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-red-700 text-sm flex items-start gap-2">
                      <span className="text-red-600 font-bold text-lg leading-none mt-0.5">!</span>
                      <span>{warning}</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 text-sm">주의사항이 없습니다</p>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
