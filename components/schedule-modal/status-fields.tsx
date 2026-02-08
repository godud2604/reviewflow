import type { Schedule } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getStatusOptions } from './utils';

type StatusFieldsProps = {
  value: Schedule['status'];
  reviewType: Schedule['reviewType'] | undefined;
  onChange: (value: Schedule['status']) => void;
  showCompletionOnboarding: boolean;
  isEditing: boolean;
};

export default function StatusFields({
  value,
  reviewType,
  onChange,
  showCompletionOnboarding,
  isEditing,
}: StatusFieldsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label
          className={`block text-[15px] font-bold ${showCompletionOnboarding && isEditing ? 'text-orange-500' : 'text-neutral-500'} mb-2`}
        >
          진행 상태
        </label>
        <Select value={value} onValueChange={(next) => onChange(next as Schedule['status'])}>
          <SelectTrigger
            size="default"
            className={`w-full ${showCompletionOnboarding && isEditing ? 'bg-orange-100 border-orange-100' : 'bg-[#F7F7F8] border-none'} rounded-xl text-[16px]`}
          >
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {getStatusOptions(reviewType || '제공형').map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption} className="text-[15px]">
                {statusOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showCompletionOnboarding && isEditing && (
          <p className="text-[13px] text-orange-700 mt-2">진행 상태를 변경 후 저장해주세요.</p>
        )}
      </div>
    </div>
  );
}
