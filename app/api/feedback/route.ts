import { NextRequest, NextResponse } from 'next/server';
import { sendFeedbackToGoogleChat } from '@/lib/google-chat';

type FeedbackAuthor = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

type FeedbackPayload = {
  feedbackType?: string;
  content?: string;
  author?: FeedbackAuthor | string;
};

function formatFeedbackType(value: string) {
  switch (value) {
    case 'feature':
      return '기능 추가 요청';
    case 'bug':
      return '에러 보고';
    case 'feedback':
      return '기타 피드백';
    default:
      return value || 'Unknown';
  }
}

function formatAuthor(author: FeedbackPayload['author']) {
  if (!author) return 'Unknown';
  if (typeof author === 'string') return author;

  const parts = [author.name, author.email, author.id].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Unknown';
}

export async function POST(request: NextRequest) {
  try {
    const payload: FeedbackPayload = await request.json().catch(() => ({}));
    const content = payload.content?.trim() ?? '';

    if (!content) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    const feedbackType = formatFeedbackType(payload.feedbackType ?? 'Unknown');
    const author = formatAuthor(payload.author);

    let notified = true;
    let notifyErrorMessage: string | null = null;

    try {
      await sendFeedbackToGoogleChat({
        feedbackType,
        content,
        author,
      });
    } catch (notifyError) {
      notified = false;
      notifyErrorMessage =
        notifyError instanceof Error ? notifyError.message : 'Google Chat notification failed';
      console.error('Google Chat feedback notification failed:', notifyError);
    }

    return NextResponse.json({ success: true, notified, notifyErrorMessage });
  } catch (error) {
    console.error('Failed to send feedback to Google Chat:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reporting failed' },
      { status: 500 }
    );
  }
}
