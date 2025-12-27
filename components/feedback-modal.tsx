'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { Z_INDEX } from '@/lib/z-index';

export default function FeedbackModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [feedbackType, setFeedbackType] = useState<'feature' | 'bug' | 'feedback'>('feature');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: '내용을 입력해주세요',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }

    if (!user) {
      toast({
        title: '로그인이 필요합니다.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('feedback_messages').insert({
        user_id: user.id,
        feedback_type: feedbackType,
        content: content.trim(),
        metadata: {
          source: 'profile_page',
          email: user.email ?? null,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: '피드백이 저장되었습니다.',
        duration: 1000,
      });

      setContent('');
      onClose();
    } catch (err) {
      toast({
        title: '피드백 전송에 실패했습니다.',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { value: 'feature', label: '기능 추가 요청', icon: '✨' },
    { value: 'bug', label: '에러 보고', icon: '🐛' },
    { value: 'feedback', label: '기타 피드백', icon: '💬' },
  ];

  return (
    <>
      <div
        className="absolute top-0 left-0 w-full h-full bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ touchAction: 'none', zIndex: Z_INDEX.backdrop }}
      />
      <div
        className="absolute bottom-0 left-0 w-full h-[500px] bg-white rounded-t-[30px] flex flex-col animate-slide-up"
        style={{ zIndex: Z_INDEX.panel }}
      >
        <div
          className="w-full bg-white rounded-t-3xl p-6 slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">개발자에게 피드백 보내기</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-neutral-700">
                피드백 유형
              </label>
              <div className="grid grid-cols-3 gap-2">
                {feedbackTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setFeedbackType(type.value as any)}
                    className={`
                      py-3 px-2 rounded-xl border-2 transition-all
                      flex flex-col items-center gap-1 cursor-pointer
                      ${
                        feedbackType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }
                    `}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <span className="text-xs font-medium text-center">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-neutral-700">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  feedbackType === 'feature'
                    ? '어떤 기능이 필요하신가요?'
                    : feedbackType === 'bug'
                      ? '어떤 문제가 발생했나요?'
                      : '자유롭게 의견을 남겨주세요'
                }
                className="w-full h-40 p-3 border border-neutral-200 rounded-xl resize-none
                  focus:outline-none focus:border-blue-500 transition-colors"
              />
              <div className="text-xs text-neutral-500 mt-1 text-right">{content.length} / 500</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold
                  hover:bg-blue-600 transition-colors cursor-pointer active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? '전송 중...' : '전송'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
