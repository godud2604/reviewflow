import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const createErrorResponse = (message: string, status = 500) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')?.trim();
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return createErrorResponse('로그인이 필요합니다.', 401);
  }

  const token = tokenMatch[1];

  try {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      return createErrorResponse('세션 정보를 확인할 수 없습니다.', 401);
    }

    const adminClient = getSupabaseAdminClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      userData.user.id
    );

    if (deleteError) {
      return createErrorResponse(
        deleteError.message ?? '계정 삭제에 실패했습니다.',
        500
      );
    }

    return NextResponse.json({ message: '계정이 삭제되었습니다.' });
  } catch (error) {
    console.error('계정 삭제 오류:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : '계정 삭제 중 오류가 발생했습니다.',
      500
    );
  }
}
