import Image from 'next/image';
import type { GuideFile } from '@/types';

type GuideFilesSectionProps = {
  guideFiles: GuideFile[];
  guideFilePreviews: Record<string, string>;
  onDownload: (file: GuideFile) => void;
  onRequestDelete: (file: GuideFile, index: number) => void;
};

export default function GuideFilesSection({
  guideFiles,
  guideFilePreviews,
  onDownload,
  onRequestDelete,
}: GuideFilesSectionProps) {
  return (
    <div className="scroll-mt-[70px] mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold text-neutral-500">영수증</span>
        <span className="text-xs text-neutral-400">{guideFiles.length}개</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {guideFiles.map((file, index) => {
          const previewUrl = guideFilePreviews[file.path];
          const isImage = file.type.startsWith('image/');
          return (
            <div key={file.path} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="relative h-28 w-full overflow-hidden rounded-xl bg-neutral-200">
                {isImage && previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={file.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[11px] font-semibold text-neutral-500">
                    <span className="tracking-tight">미리보기 없음</span>
                    <span className="mt-1 text-[10px] uppercase">{file.type.split('/')[1] || '파일'}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-neutral-700 truncate">{file.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDownload(file)}
                    className="text-[11px] font-semibold text-[#FF5722] hover:text-[#d14500] shrink-0"
                  >
                    다운로드
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(file, index)}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-800 shrink-0"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
