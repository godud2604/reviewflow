-- =============================================
-- Supabase Storage 버킷 생성
-- =============================================

-- guide-files 버킷 생성 (가이드 첨부파일용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guide-files',
  'guide-files',
  false,  -- private bucket (RLS로 접근 제어)
  10485760,  -- 10MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage RLS 정책
-- =============================================

-- 사용자는 자신의 폴더에만 파일 업로드 가능
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'guide-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 사용자는 자신의 파일만 조회 가능
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'guide-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 사용자는 자신의 파일만 수정 가능
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'guide-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 사용자는 자신의 파일만 삭제 가능
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'guide-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
