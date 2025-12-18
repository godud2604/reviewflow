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

  // 1. 서명된 URL 가져오기 (이미지를 브라우저에서 직접 열기 위함)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('guide-files')
    .createSignedUrl(filePath, 60); // 60초간 유효한 URL

  if (urlError || !urlData) {
    alert("파일 주소를 가져오지 못했습니다.");
    return;
  }

  // 2. 확장자 확인
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);

  if (isImage) {
    // 이미지라면 새 탭에서 열기 -> 사용자가 꾹 눌러서 '사진 저장' 유도
    window.open(urlData.signedUrl, '_blank');
  } else {
    // 이미지가 아니라면(PDF 등) 기존처럼 파일 다운로드 실행
    const res = await fetch(urlData.signedUrl);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(blobUrl);
  }
}