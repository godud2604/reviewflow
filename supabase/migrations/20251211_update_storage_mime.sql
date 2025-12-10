-- guide-files 버킷 MIME 허용 목록 확장
-- 모바일에서 MIME이 비어 application/octet-stream 으로 전달되는 파일 허용
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]
WHERE id = 'guide-files';
