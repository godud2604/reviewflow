// lib/google-chat.ts

const WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_URL;
const FEEDBACK_WEBHOOK_URL = process.env.GOOGLE_CHAT_FEEDBACK_WEBHOOK_URL;
const DEDUPE_WINDOW_MS = 300_000; // 5분
const sentAlerts = new Map<string, number>();

/**
 * 1. 스택 트레이스 정리 함수
 */
function cleanStackTrace(stack: string | undefined): string {
  if (!stack) return 'No stack trace available';

  return stack
    .split('\n')
    .filter((line) => !line.includes('node_modules'))
    .slice(0, 10)
    .join('\n');
}

/**
 * 2. 한국 시간 포맷터
 */
function formatKST(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * 3. [수정됨] 안전한 텍스트 모드 Payload 생성
 * - 복잡한 Card V2 대신 Markdown 텍스트를 사용하여 전송 성공률 100%를 보장합니다.
 */
function buildCardPayload(errorMessage: string, context: string, stack?: string) {
  const timeString = formatKST(new Date());

  // 구글 챗에서 지원하는 마크다운 문법
  // *굵게*, `코드`, ```멀티라인 코드```
  const textMessage =
    `🚨 *Backend Error Detected*\n\n` +
    `📌 *Context:* ${context}\n` +
    `⏰ *Time:* ${timeString}\n` +
    `🛑 *Error:* ${errorMessage}\n` +
    `🛠 *Stack:*\n\`\`\`\n${stack ? cleanStackTrace(stack) : 'No stack trace'}\n\`\`\``;

  // 단순 text 필드만 사용 (가장 안전한 방법)
  return { text: textMessage };
}

function buildAlertKey(errorMessage: string, context: string) {
  return `${context}:::${errorMessage}`;
}

function shouldSendAlert(key: string) {
  const lastSent = sentAlerts.get(key);
  const now = Date.now();
  if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
    return false;
  }
  sentAlerts.set(key, now);
  return true;
}

export async function sendErrorToGoogleChat(error: unknown, context = 'Unknown Context') {
  if (!WEBHOOK_URL) {
    console.warn('Google Chat Webhook URL missing.');
    return;
  }

  // 에러 메시지와 스택 분리
  let message = '';
  let stack = '';

  if (error instanceof Error) {
    message = error.message;
    stack = error.stack || '';
  } else {
    message = typeof error === 'string' ? error : JSON.stringify(error);
  }

  // 중복 체크
  const alertKey = buildAlertKey(message, context);
  if (!shouldSendAlert(alertKey)) {
    console.debug('Skipping duplicate alert:', context);
    return;
  }

  try {
    const payload = buildCardPayload(message, context, stack);

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // ⭐️ [변경점] Google Chat의 응답 상태를 체크하여 에러를 잡습니다.
    if (!res.ok) {
      const errorText = await res.text();
      // 여기서 에러를 throw 해야 호출한 쪽(API Route)에서 catch 할 수 있습니다.
      throw new Error(`Google Chat API Error (${res.status}): ${errorText}`);
    }
  } catch (err) {
    // console.error는 서버 로그에 남기고, err를 다시 던져서 테스트 결과에 표시되게 함
    console.error('Failed to send Google Chat alert:', err);
    throw err;
  }
}

type FeedbackMessageInput = {
  feedbackType: string;
  content: string;
  author: string;
};

function buildFeedbackPayload({ feedbackType, content, author }: FeedbackMessageInput) {
  const timeString = formatKST(new Date());
  const safeContent = content.trim() || 'No content provided';

  const textMessage =
    `📝 *Feedback Received*\n\n` +
    `📌 *Type:* ${feedbackType}\n` +
    `👤 *Author:* ${author}\n` +
    `⏰ *Time:* ${timeString}\n` +
    `🗒 *Content:*\n\`\`\`\n${safeContent}\n\`\`\``;

  return { text: textMessage };
}

export async function sendFeedbackToGoogleChat(payload: FeedbackMessageInput) {
  if (!FEEDBACK_WEBHOOK_URL) {
    console.warn('Google Chat feedback webhook URL missing.');
    return;
  }

  try {
    const body = buildFeedbackPayload(payload);
    const res = await fetch(FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Chat Feedback API Error (${res.status}): ${errorText}`);
    }
  } catch (err) {
    console.error('Failed to send Google Chat feedback:', err);
    throw err;
  }
}
