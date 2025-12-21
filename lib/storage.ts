import { getSupabaseClient } from './supabase';

export interface UploadedFile {
  name: string; // 원본 파일명
  path: string; // Storage 내 경로
  size: number; // 파일 크기 (bytes)
  type: string; // MIME type
}

const PROFILE_IMAGES_BUCKET = 'profile-images';

/**
 * 파일을 Supabase Storage에 업로드
 */
export async function uploadGuideFile(
  userId: string,
  scheduleId: number | string,
  file: File
): Promise<UploadedFile | null> {
  const supabase = getSupabaseClient();

  // 파일 경로: {userId}/{scheduleId}/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
  const filePath = `${userId}/${scheduleId}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage.from('guide-files').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    // 모바일 브라우저에서 MIME이 비어 있는 경우가 있어 PDF로 강제 지정해 허용 타입 검사를 통과시킨다
    contentType: file.type || 'application/pdf',
  });

  if (error) {
    console.error('파일 업로드 오류:', error);
    throw new Error(error.message || '파일 업로드 오류가 발생했습니다.');
  }

  return {
    name: file.name,
    path: data.path,
    size: file.size,
    type: file.type,
  };
}

/**
 * 여러 파일을 한번에 업로드
 */
export async function uploadGuideFiles(
  userId: string,
  scheduleId: number | string,
  files: File[]
): Promise<UploadedFile[]> {
  const results = await Promise.all(files.map((file) => uploadGuideFile(userId, scheduleId, file)));

  return results;
}

/**
 * 파일 다운로드 URL 생성 (1시간 유효)
 */
export async function getGuideFileUrl(
  filePath: string,
  forDownload = false
): Promise<string | null> {
  const supabase = getSupabaseClient();

  const options: { download?: string | boolean } = {};
  if (forDownload) {
    options.download = true;
  }

  const { data, error } = await supabase.storage
    .from('guide-files')
    .createSignedUrl(filePath, 3600, options); // 1시간 유효

  if (error) {
    console.error('파일 URL 생성 오류:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * 파일 삭제
 */
export async function deleteGuideFile(filePath: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from('guide-files').remove([filePath]);

  if (error) {
    console.error('파일 삭제 오류:', error);
    return false;
  }

  return true;
}

/**
 * 여러 파일 삭제
 */
export async function deleteGuideFiles(filePaths: string[]): Promise<boolean> {
  if (filePaths.length === 0) return true;

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from('guide-files').remove(filePaths);

  if (error) {
    console.error('파일 삭제 오류:', error);
    return false;
  }

  return true;
}

/**
 * 파일 다운로드
 */
export async function downloadGuideFile(filePath: string, fileName: string): Promise<void> {
  const supabase = getSupabaseClient();

  // 1. 우선 파일 데이터를 가져옵니다.
  const { data, error } = await supabase.storage.from('guide-files').download(filePath);
  if (error || !data) {
    alert('파일을 불러오지 못했습니다.');
    return;
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

  // --- [A] 모바일 환경 (iOS, 안드로이드) ---
  if (isMobile) {
    // 1. 공유 메뉴(Share Sheet) 시도
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([data], fileName, { type: data.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
          });
          return; // 성공 시 여기서 함수 종료 (새 창 안 뜸)
        }
      } catch (err) {
        console.log('공유 취소 또는 실패', err);
        // 사용자가 공유를 취소한 경우나 실패 시에만 아래(새 창)로 넘어감
      }
    }

    // 2. 공유 메뉴 실패 시 마지막 수단: 새 창에 이미지 띄우기 (꾹 눌러 저장)
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result;
      const newWin = window.open();
      if (newWin) {
        newWin.document.write(`<img src="${b64}" style="width:100%;" />`);
      }
    };
    reader.readAsDataURL(data);
    return;
  }

  // --- [B] 노트북/데스크탑 환경 (PC) ---
  // PC는 공유 메뉴 없이 바로 '클릭' 이벤트를 통해 즉시 다운로드합니다.
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function uploadProfileImage(userId: string, file: File): Promise<UploadedFile> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
  const filePath = `${userId}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

  if (error) {
    console.error('프로필 사진 업로드 오류:', error);
    throw new Error(error.message || '프로필 사진을 업로드하지 못했습니다.');
  }

  return {
    name: file.name,
    path: data?.path ?? filePath,
    size: file.size,
    type: file.type,
  };
}

export async function getProfileImageUrl(
  filePath: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error('프로필 사진 URL 생성 오류:', error);
    return null;
  }

  return data?.signedUrl ?? null;
}

export async function deleteProfileImage(filePath: string): Promise<boolean> {
  if (!filePath) return true;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(PROFILE_IMAGES_BUCKET).remove([filePath]);

  if (error) {
    console.error('프로필 사진 삭제 오류:', error);
    return false;
  }

  return true;
}
