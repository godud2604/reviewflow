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

  try {
    // 1. Supabase에서 파일을 직접 다운로드 (data는 Blob 객체)
    const { data, error } = await supabase.storage
      .from('guide-files')
      .download(filePath);

    if (error || !data) {
      throw new Error(error?.message || '파일을 불러오지 못했습니다.');
    }

    // 2. Blob을 URL로 변환
    const blobUrl = window.URL.createObjectURL(data);
    
    // 3. 임시 <a> 태그 생성
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', fileName); // 다운로드 파일명 지정
    
    // iOS/Safari 대응: target을 _blank로 설정하지 않고 현재 창에서 처리하거나, 
    // 직접 click()이 작동하지 않을 경우를 대비해 body에 추가
    document.body.appendChild(link);
    
    // 4. 실행
    link.click();
    
    // 5. 정리 (약간의 지연을 주어 사파리가 파일을 처리할 시간을 줌)
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

  } catch (err) {
    console.error('다운로드 오류:', err);
    // 모바일 사용자를 위해 alert나 toast로 에러 알림 필요
    alert('파일을 다운로드할 수 없습니다. 사파리 설정에서 팝업 차단 해제가 되어있는지 확인해주세요.');
  }
}