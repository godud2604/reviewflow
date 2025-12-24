'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { Schedule, ExtraIncome, HistoryView } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type IncomeHistoryItem = {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: Schedule['category'] | '기타';
  type: 'schedule' | 'extra';
  extraIncomeId?: number;
  sourceSchedule?: Schedule;
  sourceExtraIncome?: ExtraIncome;
};

export default function IncomeHistoryModal({
  isOpen,
  onClose,
  schedules,
  extraIncomes,
  viewType = 'all',
  onDeleteExtraIncome,
  onScheduleItemClick,
  onExtraIncomeItemClick,
  isDisabled = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  schedules: Schedule[];
  extraIncomes: ExtraIncome[];
  viewType?: HistoryView;
  onDeleteExtraIncome?: (id: number) => Promise<boolean>;
  onScheduleItemClick?: (schedule: Schedule) => void;
  onExtraIncomeItemClick?: (income: ExtraIncome) => void;
  isDisabled?: boolean;
}) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const { toast } = useToast();

  const toNumber = (value?: number | string | null) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  type ScheduleHistoryPoolItem = {
    id: string;
    title: string;
    date?: string;
    category: Schedule['category'];
    type: 'schedule';
    sourceSchedule: Schedule;
    benefit: number;
    income: number;
    cost: number;
    netValue: number;
  };

  const schedulePool: ScheduleHistoryPoolItem[] = schedules.map((schedule) => {
    const benefit = toNumber(schedule.benefit);
    const income = toNumber(schedule.income);
    const cost = toNumber(schedule.cost);
    return {
      id: `schedule-${schedule.id}`,
      title: schedule.title,
      date: schedule.visit || schedule.dead,
      category: schedule.category,
      type: 'schedule',
      sourceSchedule: schedule,
      benefit,
      income,
      cost,
      netValue: benefit + income - cost,
    };
  });

  const getScheduleAmount = (data: ScheduleHistoryPoolItem) => {
    switch (viewType) {
      case 'benefit':
        return data.benefit;
      case 'income':
        return data.income;
      case 'cost':
        return data.cost;
      default:
        return data.netValue;
    }
  };

  const filteredSchedules = schedulePool
    .map((item) => ({
      ...item,
      amount: getScheduleAmount(item),
    }))
    .filter((item) => (viewType === 'all' ? item.netValue !== 0 : item.amount > 0));

  const scheduleItems: IncomeHistoryItem[] = filteredSchedules.map((item) => ({
    id: item.id,
    title: item.title,
    amount: item.amount,
    date: item.date || '',
    category: item.category,
    type: 'schedule',
    sourceSchedule: item.sourceSchedule,
  }));

  const includeExtraIncomes = viewType === 'all' || viewType === 'income';
  const extraIncomeItems = includeExtraIncomes
    ? extraIncomes.map((income) => ({
        id: `extra-${income.id}`,
        title: income.title,
        amount: income.amount,
        date: income.date,
        category: '기타' as const,
        type: 'extra' as const,
        extraIncomeId: income.id,
        sourceExtraIncome: income,
      }))
    : ([] as IncomeHistoryItem[]);

  const visibleItems = [...scheduleItems, ...extraIncomeItems].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const scheduleTotal = filteredSchedules.reduce((sum, item) => sum + item.amount, 0);
  const totalExtra = extraIncomeItems.reduce((sum, item) => sum + item.amount, 0);
  const grandTotal = scheduleTotal + totalExtra;
  const hasData = visibleItems.length > 0;
  const containerHeightClass = hasData ? 'h-[85%]' : 'h-[50%]';

  const viewTitleMap: Record<HistoryView, string> = {
    all: '이번 달 전체 수입 내역',
    benefit: '이번 달 방어한 생활비 내역',
    income: '이번 달 수입 내역',
    cost: '이번 달 지출 내역',
  };

  const scheduleLabelMap: Record<HistoryView, string> = {
    all: '체험단 합산',
    benefit: '방어한 생활비',
    income: '체험단 수입',
    cost: '지출',
  };

  const viewIconMap: Record<HistoryView, string> = {
    all: '💰',
    benefit: '🛡️',
    income: '💵',
    cost: '🧾',
  };

  const viewDescriptionMap: Record<HistoryView, string> = {
    all: '체험단 수입, 지출, 부수입을 모두 합산해 보여드립니다.',
    benefit: '체험단에서 받은 제품/서비스 값 항목만 뽑아 보여줘요.',
    income: '체험단 수입과 등록한 부수입을 함께 확인해보세요.',
    cost: '카테고리별 지출을 정리해서 보여드립니다.',
  };

  const getTypeLabel = (item: IncomeHistoryItem) => {
    if (item.type === 'extra') return '기타 부수입';
    return scheduleLabelMap[viewType];
  };

  const getTypeColor = (item: IncomeHistoryItem) => {
    if (item.type === 'extra') return 'bg-blue-50 text-blue-700';
    switch (viewType) {
      case 'benefit':
        return 'bg-orange-50 text-orange-700';
      case 'income':
        return 'bg-blue-50 text-blue-700';
      case 'cost':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-orange-50 text-orange-700';
    }
  };

  const handleItemClick = (item: IncomeHistoryItem) => {
    if (item.type === 'schedule' && item.sourceSchedule) {
      onScheduleItemClick?.(item.sourceSchedule);
    } else if (item.type === 'extra' && item.sourceExtraIncome) {
      onExtraIncomeItemClick?.(item.sourceExtraIncome);
    }
  };

  const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: IncomeHistoryItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item);
    }
  };

  const handleDeleteExtraIncome = async (incomeId?: number) => {
    if (!incomeId || !onDeleteExtraIncome) return;
    setDeletingId(incomeId);
    const success = await onDeleteExtraIncome(incomeId);
    setDeletingId(null);
    setDeleteTarget(null);

    toast({
      title: success ? '부수입이 삭제되었습니다' : '부수입 삭제에 실패했습니다',
      variant: success ? 'default' : 'destructive',
      duration: 1000,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="absolute top-0 left-0 w-full h-full bg-black/50 backdrop-blur-sm z-40 overscroll-none"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />
      <div
        className={`w-full absolute bottom-0 left-0 ${containerHeightClass} bg-gradient-to-b from-neutral-50 to-white rounded-t-[32px] z-40 flex flex-col animate-slide-up overscroll-none shadow-2xl transition-opacity ${isDisabled ? 'pointer-events-none opacity-70' : ''}`}
      >
        {/* Header */}
        <div className="p-5 pb-3 text-center relative flex-shrink-0">
          <h2 className="text-[16px] font-bold text-neutral-900">{viewTitleMap[viewType]}</h2>
          <button
            onClick={onClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Card */}
        <div className="relative mx-4 mt-1 mb-3 flex-shrink-0">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#ff9a3c] via-[#ff6a1f] to-[#ff3b0c] rounded-2xl p-5 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_28%)]" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{viewIconMap[viewType]}</span>
                  <span className="text-sm text-white/90 font-semibold">
                    {scheduleLabelMap[viewType]}
                  </span>
                </div>
                <span className="text-base font-bold text-white">
                  ₩{scheduleTotal.toLocaleString()}
                </span>
              </div>
              {includeExtraIncomes && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <span className="text-sm text-white/90 font-semibold">부수입</span>
                  </div>
                  <span className="text-base font-bold text-white">
                    ₩{totalExtra.toLocaleString()}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-white/90 leading-relaxed">
                {viewDescriptionMap[viewType]}
              </p>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent touch-pan-y">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">💸</span>
              </div>
              <p className="text-neutral-400 font-medium text-[12px]">아직 수입 내역이 없어요</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(event) => handleItemKeyDown(event, item)}
                  className="bg-white rounded-2xl p-4 shadow-sm transition-transform active:scale-[0.98] border border-neutral-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ff6a1f]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-2 truncate">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${getTypeColor(item)}`}
                        >
                          {getTypeLabel(item)}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">
                          {item.category}
                        </span>
                      </div>
                      {/* 부수입 메모 표시 */}
                      {item.type === 'extra' &&
                        (() => {
                          const extra = extraIncomes.find((e) => e.id === item.extraIncomeId);
                          return extra?.memo ? (
                            <div className="mt-2 text-xs text-neutral-400 break-words">
                              {extra.memo}
                            </div>
                          ) : null;
                        })()}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-right ml-3">
                        <div
                          className={`text-lg font-bold mb-0.5 ${item.amount < 0 ? 'text-red-500' : 'text-[#333]'}`}
                        >
                          ₩{item.amount.toLocaleString()}
                        </div>
                        {item.date && (
                          <div className="text-[10px] text-neutral-400 font-medium">
                            {item.date}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              부수입 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              '{deleteTarget?.title ?? ''}' 항목을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteExtraIncome(deleteTarget?.id)}
              disabled={deletingId === deleteTarget?.id}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
