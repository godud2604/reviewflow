import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { reviewLink, reviewNote, user } = await req.json();

  // Google Chat Webhook URL (from env)
  const WEBHOOK_URL = process.env.GOOGLE_CHAT_REVIEW_WEBHOOK_URL;
  if (!WEBHOOK_URL) {
    return NextResponse.json({ ok: false, error: 'Webhook URL not set in env' }, { status: 500 });
  }

  // 메시지 생성
  const textMessage =
    `📝 *후기 제출*
` +
    `👤 *User:* ${user?.id || 'Unknown'}\n` +
    `🔗 *Link:* ${reviewLink || '-'}\n` +
    `🗒 *Note:* ${reviewNote || '-'}\n` +
    `⏰ *Time:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textMessage }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
