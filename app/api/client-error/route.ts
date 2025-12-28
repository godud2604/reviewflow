import { NextRequest, NextResponse } from 'next/server';
import { sendErrorToGoogleChat } from '@/lib/google-chat';

type ClientErrorPayload = {
  message?: string;
  stack?: string;
  context?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload: ClientErrorPayload = await request.json().catch(() => ({}));
    const message = payload.message ?? 'Client-side error';
    const context = payload.context ?? 'Client Runtime';

    const clientError = new Error(message);
    if (payload.stack) {
      clientError.stack = payload.stack;
    }

    await sendErrorToGoogleChat(clientError, context);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to report client error to Google Chat:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reporting failed' },
      { status: 500 }
    );
  }
}
