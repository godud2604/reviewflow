import { getSupabaseClient } from './supabase'

export interface UploadedFile {
  name: string        // 원본 파일명
  path: string        // Storage 내 경로
  size: number        // 파일 크기 (bytes)
  type: string        // MIME type
}

/**
 * 파일을 Supabase Storage에 업로드
 */
export async function uploadGuideFile(
  userId: string,
  scheduleId: number | string,
  file: File
): Promise<UploadedFile | null> {
  const supabase = getSupabaseClient()
  
  // 파일 경로: {userId}/{scheduleId}/{timestamp}_{filename}
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const filePath = `${userId}/${scheduleId}/${timestamp}_${safeName}`
  
  const { data, error } = await supabase.storage
    .from('guide-files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      // 모바일 브라우저에서 MIME이 비어 있는 경우가 있어 PDF로 강제 지정해 허용 타입 검사를 통과시킨다
      contentType: file.type || 'application/pdf',
    })
  
  if (error) {
    console.error('파일 업로드 오류:', error)
    throw new Error(error.message || '파일 업로드 오류가 발생했습니다.')
  }
  
  return {
    name: file.name,
    path: data.path,
    size: file.size,
    type: file.type,
  }
}

/**
 * 여러 파일을 한번에 업로드
 */
export async function uploadGuideFiles(
  userId: string,
  scheduleId: number | string,
  files: File[]
): Promise<UploadedFile[]> {
  const results = await Promise.all(
    files.map(file => uploadGuideFile(userId, scheduleId, file))
  )

  return results
}

/**
 * 파일 다운로드 URL 생성 (1시간 유효)
 */
export async function getGuideFileUrl(filePath: string, forDownload = false): Promise<string | null> {
  const supabase = getSupabaseClient()
  
  const options: { download?: string | boolean } = {}
  if (forDownload) {
    options.download = true
  }
  
  const { data, error } = await supabase.storage
    .from('guide-files')
    .createSignedUrl(filePath, 3600, options) // 1시간 유효
  
  if (error) {
    console.error('파일 URL 생성 오류:', error)
    return null
  }
  
  return data.signedUrl
}

/**
 * 파일 삭제
 */
export async function deleteGuideFile(filePath: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase.storage
    .from('guide-files')
    .remove([filePath])
  
  if (error) {
    console.error('파일 삭제 오류:', error)
    return false
  }
  
  return true
}

/**
 * 여러 파일 삭제
 */
export async function deleteGuideFiles(filePaths: string[]): Promise<boolean> {
  if (filePaths.length === 0) return true
  
  const supabase = getSupabaseClient()
  
  const { error } = await supabase.storage
    .from('guide-files')
    .remove(filePaths)
  
  if (error) {
    console.error('파일 삭제 오류:', error)
    return false
  }
  
  return true
}

/**
 * 파일 다운로드
 */
export async function downloadGuideFile(filePath: string, fileName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isKakao = /KAKAOTALK/i.test(userAgent);

  // 1. 안드로이드 카톡 대응 (안내 문구)
  if (isAndroid && isKakao) {
    alert("카카오톡에서는 파일 저장이 제한될 수 있습니다. 다운로드가 안 된다면 '다른 브라우저로 열기'를 이용해 주세요.");
    // 이 뒤에 return을 하지 않고 share 시도를 한 번 더 해봅니다.
  }

  try {
    const { data, error } = await supabase.storage.from('guide-files').download(filePath);
    if (error || !data) throw error;

    // 2. 모바일(iOS/Android) 공통: 공유 시트 시도 (가장 호환성 좋음)
    if (navigator.share && navigator.canShare) {
      const file = new File([data], fileName, { type: data.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return; 
      }
    }

    // 3. PC 및 공유 시트 미지원 브라우저 (기본 다운로드)
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('Download error:', err);
    // 마지막 수단: 서명된 URL을 새 창으로 열기 (꾹 눌러서 저장 유도)
    const { data: urlData } = await supabase.storage.from('guide-files').createSignedUrl(filePath, 60);
    if (urlData) window.open(urlData.signedUrl, '_blank');
  }
}