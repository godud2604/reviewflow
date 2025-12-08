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
    })
  
  if (error) {
    console.error('파일 업로드 오류:', error)
    return null
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
  
  return results.filter((r): r is UploadedFile => r !== null)
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
  const supabase = getSupabaseClient()
  
  // Supabase Storage의 download 메서드 사용
  const { data, error } = await supabase.storage
    .from('guide-files')
    .download(filePath)
  
  if (error || !data) {
    console.error('다운로드 실패:', error)
    return
  }
  
  // Blob을 다운로드 링크로 변환
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // 메모리 해제
  URL.revokeObjectURL(url)
}
