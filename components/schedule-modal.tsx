'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Schedule,
  GuideFile,
  ScheduleChannel,
  ScheduleTransactionItem,
  AdditionalDeadline,
} from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useUserProfile } from '@/hooks/use-user-profile';
import {
  uploadGuideFiles,
  downloadGuideFile,
  deleteGuideFile,
  getGuideFileUrl,
} from '@/lib/storage';
import { DEFAULT_SCHEDULE_CHANNEL_OPTIONS, sanitizeChannels } from '@/lib/schedule-channels';
import {
  DEFAULT_COST_LABEL,
  DEFAULT_INCOME_LABEL,
  buildIncomeDetailsFromLegacy,
  createIncomeDetail,
  parseIncomeDetailsJson,
  sanitizeIncomeDetails,
  serializeIncomeDetails,
  sumIncomeDetails,
} from '@/lib/schedule-income-details';
import { stripLegacyScheduleMemo } from '@/lib/schedule-memo-legacy';
import { formatKoreanTime } from '@/lib/time-utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, Copy, Loader2, Search, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react';
import NaverMapSearchModal, { MapPlaceSelection } from '@/components/naver-map-search-modal';
import { Z_INDEX } from '@/lib/z-index';
import {
  BENEFIT_FIELD,
  CATEGORY_OPTIONS,
  DEFAULT_VISIT_REVIEW_CHECKLIST,
  MANAGE_BUTTON_CLASS,
  VISIT_REVIEW_OPTIONS,
  type VisitReviewToggleKey,
} from '@/components/schedule-modal/constants';
import GuideFilesSection from '@/components/schedule-modal/guide-files-section';
import { useActiveTab, useGuideFilePreviews, useViewportStyle } from '@/components/schedule-modal/hooks';
import StatusFields from '@/components/schedule-modal/status-fields';
import {
  TIME_OPTIONS,
  arraysEqual,
  createAdditionalDeadlineId,
  createEmptyFormData,
  formatAmountInput,
  formatNumber,
  formatPhoneInput,
  getTodayInKST,
  parseNumber,
  parseVisitTime,
  sanitizeStatusForReviewType,
} from '@/components/schedule-modal/utils';

export default function ScheduleModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onUpdateFiles,
  schedule,
  focusGuideFiles,
  onGuideFilesFocusDone,
  initialDeadline,
  initialMapSearchOpen,
  initialMapSearchAutoSave,
  statusChangeIntent,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: Schedule) => Promise<boolean>;
  onDelete: (id: number) => void;
  onUpdateFiles?: (id: number, files: GuideFile[]) => Promise<void>;
  schedule?: Schedule;
  focusGuideFiles?: boolean;
  onGuideFilesFocusDone?: () => void;
  initialDeadline?: string;
  initialMapSearchOpen?: boolean;
  initialMapSearchAutoSave?: boolean;
  statusChangeIntent?: boolean;
}) {
  const [formData, setFormData] = useState<Partial<Schedule>>(() => createEmptyFormData());

  const [purchaseLink, setPurchaseLink] = useState<string>('');
  const viewportStyle = useViewportStyle(isOpen);

  const [newPlatform, setNewPlatform] = useState('');
  const [platformToDelete, setPlatformToDelete] = useState<string | null>(null);
  const [duplicatePlatformAlert, setDuplicatePlatformAlert] = useState(false);
  const [emptyPlatformAlert, setEmptyPlatformAlert] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPlatformManagement, setShowPlatformManagement] = useState(false);
  const [showChannelManagement, setShowChannelManagement] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [duplicateChannelAlert, setDuplicateChannelAlert] = useState(false);
  const [emptyChannelAlert, setEmptyChannelAlert] = useState(false);
  const [reconfirmReason, setReconfirmReason] = useState('');
  const [customReconfirmReason, setCustomReconfirmReason] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileToDelete, setFileToDelete] = useState<{ file: GuideFile; index: number } | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [deadlineError, setDeadlineError] = useState(false);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [showMapSearchModal, setShowMapSearchModal] = useState(false);
  useEffect(() => {
    if (isOpen && initialMapSearchOpen) {
      setShowMapSearchModal(true);
    }
  }, [isOpen, initialMapSearchOpen]);
  const [showCompletionOnboarding, setShowCompletionOnboarding] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Schedule['category'][]>([]);
  const [visitMode, setVisitMode] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [locationDetailEnabled, setLocationDetailEnabled] = useState(false);
  const [nonVisitReviewType, setNonVisitReviewType] = useState<Schedule['reviewType']>('제공형');
  const [scheduleIncomeDetails, setScheduleIncomeDetails] = useState<ScheduleTransactionItem[]>([]);
  const [showIncomeDetailManagement, setShowIncomeDetailManagement] = useState(false);
  const [newIncomeDetailLabel, setNewIncomeDetailLabel] = useState('');
  const [newIncomeDetailType, setNewIncomeDetailType] =
    useState<ScheduleTransactionItem['type']>('INCOME');
  const [newIncomeDetailAmount, setNewIncomeDetailAmount] = useState('');
  const [paybackAmountSameAsCost, setPaybackAmountSameAsCost] = useState(false);
  const [showDeadlineManagement, setShowDeadlineManagement] = useState(false);
  const [newDeadlineLabel, setNewDeadlineLabel] = useState('');
  const deadlineComposingRef = useRef(false);
  const deadlineSubmitPendingRef = useRef(false);
  const deadlineSectionRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 메모장 자동 높이 조절을 위한 ref와 함수
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const textarea = memoTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // 높이를 초기화해서 줄어들 때도 반응하게 함
      textarea.style.height = `${textarea.scrollHeight}px`; // 스크롤 높이만큼 설정
    }
  }, []);

  const { toast } = useToast();
  const { user } = useAuth();
  const {
    platforms: userPlatforms,
    categories: userCategories,
    scheduleChannels: userChannels,
    addPlatform,
    removePlatform,
    addScheduleChannel,
    removeScheduleChannel,
    updateCategories,
    loading: profileLoading,
  } = useUserProfile();
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(false);
  const guideFilesSectionRef = useRef<HTMLDivElement | null>(null);
  const statusSectionRef = useRef<HTMLDivElement | null>(null);
  const basicInfoRef = useRef<HTMLDivElement | null>(null);
  const progressInfoRef = useRef<HTMLDivElement | null>(null);
  const assetManagementRef = useRef<HTMLDivElement | null>(null);
  const customIncomeListRef = useRef<HTMLDivElement | null>(null);
  const memoRef = useRef<HTMLDivElement | null>(null);
  const showMapSearchModalRef = useRef(showMapSearchModal);

  // 스크롤 상/하단 이동 함수 (always visible)
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [formData.memo, isOpen, autoResizeTextarea]);

  useEffect(() => {
    showMapSearchModalRef.current = showMapSearchModal;
  }, [showMapSearchModal]);

  useEffect(() => {
    if (!isOpen) return;
    setShowCompletionOnboarding(Boolean(statusChangeIntent && formData.status === '완료'));
  }, [formData.status, isOpen, statusChangeIntent]);

  const scrollToSection = (target: React.RefObject<HTMLElement | null>) => {
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const getCurrentUrl = () =>
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const pushModalState = () => {
      window.history.pushState({ scheduleModal: true }, '', getCurrentUrl());
    };

    const handlePopState = () => {
      if (showMapSearchModalRef.current) {
        setShowMapSearchModal(false);
        pushModalState();
        return;
      }

      setShowCloseConfirm(true);
      pushModalState();
    };

    pushModalState();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const allPlatforms = React.useMemo(() => {
    return [...userPlatforms].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [userPlatforms]);

  const platformOptions = React.useMemo(() => {
    if (formData.platform && !allPlatforms.includes(formData.platform)) {
      return [...allPlatforms, formData.platform];
    }
    return allPlatforms;
  }, [allPlatforms, formData.platform]);

  const allChannels = React.useMemo(() => {
    const baseChannels = userChannels.length > 0 ? userChannels : DEFAULT_SCHEDULE_CHANNEL_OPTIONS;
    return [...baseChannels].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [userChannels]);

  const channelOptions = React.useMemo(() => {
    const existing = new Set(allChannels);
    const extras = Array.from(
      new Set((formData.channel || []).filter((channel) => !existing.has(channel)))
    );
    return [...allChannels, ...extras];
  }, [allChannels, formData.channel]);

  const categoryValues = React.useMemo(() => CATEGORY_OPTIONS.map((option) => option.value), []);

  const sanitizeCategories = React.useCallback(
    (list: string[] | undefined | null) => {
      const allowed = new Set(categoryValues);
      return Array.from(
        new Set(
          (list || [])
            .map((c) => c?.trim())
            .filter((c): c is Schedule['category'] => !!c && allowed.has(c as Schedule['category']))
        )
      );
    },
    [categoryValues]
  );

  const getIncomeDetailKey = (type: ScheduleTransactionItem['type'], label: string) =>
    `${type}:${label.trim()}`;

  const isDefaultIncomeDetail = (detail: ScheduleTransactionItem) =>
    detail.type === 'INCOME' && detail.label.trim() === DEFAULT_INCOME_LABEL;

  const isDefaultCostDetail = (detail: ScheduleTransactionItem) =>
    detail.type === 'EXPENSE' && detail.label.trim() === DEFAULT_COST_LABEL;

  const ensureDefaultIncomeDetails = (details: ScheduleTransactionItem[]) => {
    const next = [...details];
    if (!next.some(isDefaultIncomeDetail)) {
      next.unshift({ ...createIncomeDetail('INCOME', DEFAULT_INCOME_LABEL), enabled: true });
    }
    if (!next.some(isDefaultCostDetail)) {
      next.push({ ...createIncomeDetail('EXPENSE', DEFAULT_COST_LABEL), enabled: true });
    }
    return next;
  };

  const hasVisitData = React.useCallback((data?: Partial<Schedule>) => {
    if (!data) return false;
    const checklist = data.visitReviewChecklist;
    const hasChecklist =
      !!checklist &&
      (checklist.naverReservation ||
        checklist.platformAppReview ||
        checklist.cafeReview ||
        checklist.googleReview ||
        checklist.other ||
        !!checklist.otherText);
    return data.reviewType === '방문형' || !!data.visit || !!data.visitTime || hasChecklist;
  }, []);

  useEffect(() => {
    if (schedule) {
      const initialNonVisit = schedule.reviewType !== '방문형' ? schedule.reviewType : '제공형';
      const parsedDetails = parseIncomeDetailsJson(schedule.incomeDetailsJson);
      const fallbackDetails = buildIncomeDetailsFromLegacy(schedule.income, schedule.cost);
      const mergedDetails = parsedDetails.length ? parsedDetails : fallbackDetails;
      setScheduleIncomeDetails(ensureDefaultIncomeDetails(mergedDetails));
      setNonVisitReviewType(initialNonVisit);
      setFormData({
        ...schedule,
        memo: stripLegacyScheduleMemo(schedule.memo),
        visitReviewChecklist:
          schedule.reviewType === '방문형'
            ? { ...DEFAULT_VISIT_REVIEW_CHECKLIST, ...schedule.visitReviewChecklist }
            : schedule.visitReviewChecklist,
        paybackExpected: schedule.paybackExpected ?? false,
        paybackExpectedDate: schedule.paybackExpected
          ? schedule.paybackExpectedDate || schedule.dead || ''
          : '',
        paybackExpectedAmount: schedule.paybackExpected ? schedule.paybackExpectedAmount || 0 : 0,
        paybackConfirmed: schedule.paybackExpected ? !!schedule.paybackConfirmed : false,
      });
      setPaybackAmountSameAsCost(false);
      // 기존 schedule에 purchaseLink가 있으면 상태에 반영
      if (schedule?.purchaseLink) {
        setPurchaseLink(schedule.purchaseLink);
      } else {
        setPurchaseLink('');
      }

      setVisitMode(hasVisitData(schedule));
      setLocationDetailEnabled(Boolean(schedule.regionDetail));
    } else {
      const emptyForm = createEmptyFormData();
      if (initialDeadline) {
        emptyForm.dead = initialDeadline;
      }
      setFormData(emptyForm);
      setPaybackAmountSameAsCost(false);
      setReconfirmReason('');
      setCustomReconfirmReason('');
      setPendingFiles([]);
      setVisitMode(false);
      setNonVisitReviewType('제공형');
      setLocationDetailEnabled(false);
      setScheduleIncomeDetails(ensureDefaultIncomeDetails([]));
    }
  }, [schedule, isOpen, hasVisitData, initialDeadline]);

  useEffect(() => {
    if (!formData.paybackExpected) return;
    if (!paybackAmountSameAsCost) return;
    const costAmount = scheduleIncomeDetails.find(isDefaultCostDetail)?.amount || 0;
    setFormData((prev) => ({ ...prev, paybackExpectedAmount: costAmount }));
  }, [formData.paybackExpected, paybackAmountSameAsCost, scheduleIncomeDetails]);

  useEffect(() => {
    const sanitized = sanitizeCategories(userCategories);
    if (!arraysEqual(selectedCategories, sanitized)) {
      setSelectedCategories(sanitized);
    }
  }, [userCategories, sanitizeCategories, selectedCategories]);

  const guideFilesCount = formData.guideFiles?.length ?? 0;
  const guideFilePreviews = useGuideFilePreviews(formData.guideFiles, getGuideFileUrl);
  const activeTab = useActiveTab({
    containerRef: scrollContainerRef,
    basicInfoRef,
    progressInfoRef,
    assetManagementRef,
    memoRef,
    guideFilesSectionRef,
    enabled: isOpen,
    guideFilesCount,
  });

  useEffect(() => {
    if (!focusGuideFiles || !isOpen) return;
    const section = guideFilesSectionRef.current;
    if (!section) {
      return;
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onGuideFilesFocusDone?.();
  }, [focusGuideFiles, isOpen, guideFilesCount, onGuideFilesFocusDone]);

  useEffect(() => {
    const allowed = new Set(categoryValues);
    const hasValidCurrent = formData.category && allowed.has(formData.category);
    const fallback = selectedCategories[0] || CATEGORY_OPTIONS[0]?.value;
    const nextCategory = hasValidCurrent ? formData.category : fallback;
    if (nextCategory && nextCategory !== formData.category) {
      setFormData((prev) => ({ ...prev, category: nextCategory as Schedule['category'] }));
    }
  }, [selectedCategories, formData.category, categoryValues]);

  useEffect(() => {
    if (schedule) return;
    const defaultPlatform = allPlatforms[0];
    if (!defaultPlatform) return;
    if (formData.platform) return;
    setFormData((prev) => ({ ...prev, platform: defaultPlatform }));
  }, [allPlatforms, schedule, formData.platform]);

  const handleSave = async (overrideFormData?: Partial<Schedule>) => {
    if (isSubmittingRef.current) return;
    const mergedFormData = overrideFormData ? { ...formData, ...overrideFormData } : formData;
    const trimmedTitle = (mergedFormData.title ?? '').trim();
    const missingTitle = trimmedTitle === '';
    const missingDeadline = !mergedFormData.dead;
    if (missingTitle || missingDeadline) {
      setTitleError(missingTitle);
      setDeadlineError(missingDeadline);
      toast({
        title: '필수 정보를 모두 입력해주세요.',
        description: '체험단명과 마감일은 반드시 입력해야 합니다.',
        variant: 'destructive',
        duration: 1000,
      });
      // 마감일이 비어있으면 해당 위치로 스크롤
      if (missingDeadline && deadlineSectionRef.current) {
        deadlineSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const updatedFormData: Partial<Schedule> = { ...mergedFormData };
      updatedFormData.title = trimmedTitle;
      // purchaseLink를 저장 데이터에 포함
      updatedFormData.purchaseLink = purchaseLink;
      const hasInvalidDetails = activeScheduleDetails.some(
        (detail) => detail.enabled !== false && detail.amount > 0 && !detail.label.trim()
      );
      if (hasInvalidDetails) {
        toast({
          title: '수익/지출 항목 이름을 입력해주세요.',
          variant: 'destructive',
          duration: 1000,
        });
        return;
      }
      const mappedDetails: ScheduleTransactionItem[] = activeScheduleDetails.map(
        (detail): ScheduleTransactionItem =>
          isDefaultIncomeDetail(detail) || isDefaultCostDetail(detail)
            ? { ...detail, enabled: true }
            : detail
      );
      const sanitizedDetails = ensureDefaultIncomeDetails(
        sanitizeIncomeDetails(mappedDetails as ScheduleTransactionItem[])
      );
      const { incomeTotal, costTotal } = sumIncomeDetails(sanitizedDetails);
      updatedFormData.income = incomeTotal;
      updatedFormData.cost = costTotal;
      updatedFormData.incomeDetailsJson = serializeIncomeDetails(sanitizedDetails);
      const reviewTypeForSave = visitMode ? '방문형' : nonVisitReviewType;
      updatedFormData.reviewType = reviewTypeForSave;
      if (!visitMode) {
        updatedFormData.visit = '';
        updatedFormData.visitTime = '';
        updatedFormData.visitReviewChecklist = undefined;
      } else if (!updatedFormData.visitReviewChecklist) {
        updatedFormData.visitReviewChecklist = { ...DEFAULT_VISIT_REVIEW_CHECKLIST };
      }

      if (updatedFormData.status === '재확인' && reconfirmReason) {
        const reason = reconfirmReason === '기타' ? customReconfirmReason : reconfirmReason;
        updatedFormData.reconfirmReason = reason;
      } else {
        updatedFormData.reconfirmReason = '';
      }

      if (updatedFormData.paybackExpected) {
        updatedFormData.paybackExpectedDate =
          updatedFormData.paybackExpectedDate || updatedFormData.dead || '';
        if (!updatedFormData.paybackExpectedAmount || updatedFormData.paybackExpectedAmount < 0) {
          updatedFormData.paybackExpectedAmount = 0;
        }
      } else {
        updatedFormData.paybackExpectedDate = '';
        updatedFormData.paybackExpectedAmount = 0;
        updatedFormData.paybackConfirmed = false;
      }

      const selectedChannels = sanitizeChannels(updatedFormData.channel || [], {
        allowEmpty: true,
        allowed: channelOptions,
      });

      let finalGuideFiles = updatedFormData.guideFiles || [];
      if (pendingFiles.length > 0 && user) {
        setIsUploading(true);
        try {
          const scheduleId = schedule?.id || `new_${Date.now()}`;
          const uploadedFiles = await uploadGuideFiles(user.id, scheduleId, pendingFiles);
          if (uploadedFiles.length !== pendingFiles.length) {
            const message = '일부 파일이 업로드되지 않았습니다. 다시 시도해주세요.';
            toast({
              title: message,
              variant: 'destructive',
              duration: 1000,
            });
            if (typeof window !== 'undefined') {
              alert(message);
            }
            setIsUploading(false);
            return;
          }
          finalGuideFiles = [...finalGuideFiles, ...uploadedFiles];
          setPendingFiles([]);
        } catch (error) {
          console.error('파일 업로드 실패:', error);
          const errorMsg = error instanceof Error ? error.message : '';
          const message = errorMsg
            ? `파일 업로드에 실패했습니다: ${errorMsg}`
            : '파일 업로드에 실패했습니다. 다시 시도해주세요.';
          toast({
            title: message,
            variant: 'destructive',
            duration: 1000,
          });
          if (typeof window !== 'undefined') {
            alert(message);
          }
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
      }

      const sanitizedStatus = sanitizeStatusForReviewType(
        updatedFormData.status as Schedule['status'],
        (updatedFormData.reviewType as Schedule['reviewType']) || '제공형'
      );

      const savedSuccessfully = await onSave({
        ...updatedFormData,
        status: sanitizedStatus,
        channel: selectedChannels,
        guideFiles: finalGuideFiles,
      } as Schedule);

      if (savedSuccessfully) {
        toast({
          title: schedule ? '체험단 정보가 수정되었습니다.' : '체험단이 등록되었습니다.',
          duration: 1000,
        });
      }
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleDownloadFile = async (file: GuideFile) => {
    toast({
      title: '다운로드 시작',
      description: '잠시만 기다려 주세요.',
      duration: 1000,
    });

    try {
      await downloadGuideFile(file.path, file.name);
    } catch (error) {
      toast({
        title: '다운로드 실패',
        description: "인앱 브라우저라면 '다른 브라우저로 열기'를 시도해 보세요.",
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUploadedFile = async (file: GuideFile, index: number) => {
    if (schedule) {
      const success = await deleteGuideFile(file.path);
      if (!success) {
        toast({
          title: '파일 삭제에 실패했습니다.',
          variant: 'destructive',
          duration: 1000,
        });
        return;
      }
    }

    const newFiles = formData.guideFiles?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, guideFiles: newFiles });

    if (schedule && onUpdateFiles) {
      await onUpdateFiles(schedule.id, newFiles);
    }

    toast({
      title: '파일이 삭제되었습니다.',
      duration: 1000,
    });

    setFileToDelete(null);
  };

  const handleToggleCategory = async (value: Schedule['category']) => {
    const wasSelected = selectedCategories.includes(value);
    const prev = selectedCategories;
    const next = wasSelected
      ? selectedCategories.filter((c) => c !== value)
      : [...selectedCategories, value];
    setSelectedCategories(next);

    const success = await updateCategories(next);
    if (!success) {
      setSelectedCategories(prev);
      return;
    }
  };

  const handleNumberChange = (field: 'benefit', value: string) => {
    const numValue = parseNumber(value);
    setFormData({ ...formData, [field]: numValue });
  };

  const handleIncomeDetailChange = (id: string, updates: Partial<ScheduleTransactionItem>) => {
    setScheduleIncomeDetails((prev) =>
      prev.map((detail) => (detail.id === id ? { ...detail, ...updates } : detail))
    );
  };

  const scrollToCustomIncomeList = () => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(max-width: 640px)').matches) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const target = customIncomeListRef.current;
        if (!container || !target) {
          customIncomeListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const extraOffset = 80;
        const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - extraOffset;
        container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      }, 80);
    });
  };

  const handleAddIncomeDetailFromModal = () => {
    const trimmedLabel = newIncomeDetailLabel.trim();
    if (!trimmedLabel) {
      toast({
        title: '항목 이름을 입력해주세요.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }
    if (
      (newIncomeDetailType === 'INCOME' && trimmedLabel === DEFAULT_INCOME_LABEL) ||
      (newIncomeDetailType === 'EXPENSE' && trimmedLabel === DEFAULT_COST_LABEL)
    ) {
      toast({
        title: '기본 항목과 동일한 이름입니다.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }
    const amountValue = parseNumber(newIncomeDetailAmount);
    const duplicate = scheduleIncomeDetails.some(
      (detail) =>
        getIncomeDetailKey(detail.type, detail.label) ===
        getIncomeDetailKey(newIncomeDetailType, trimmedLabel)
    );
    if (duplicate) {
      toast({
        title: '이미 등록된 항목입니다.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }
    const newDetail = {
      ...createIncomeDetail(newIncomeDetailType, trimmedLabel),
      amount: amountValue,
      enabled: true,
    };
    setScheduleIncomeDetails((prev) => [...prev, newDetail]);
    setNewIncomeDetailLabel('');
    setNewIncomeDetailType('INCOME');
    setNewIncomeDetailAmount('');
    toast({
      title: '항목이 추가되었습니다.',
      duration: 1000,
    });
    scrollToCustomIncomeList();
  };

  const handleRemoveScheduleIncomeDetail = (id: string) => {
    setScheduleIncomeDetails((prev) => prev.filter((detail) => detail.id !== id));
  };

  const handleAddDeadlineTemplate = () => {
    const trimmedLabel = newDeadlineLabel.trim();
    if (!trimmedLabel) {
      toast({
        title: '항목 이름을 입력해주세요.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }
    const duplicate = (formData.additionalDeadlines || []).some(
      (deadline) => deadline.label === trimmedLabel
    );
    if (duplicate) {
      toast({
        title: '이미 등록된 항목입니다.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }
    const nextDeadline: AdditionalDeadline = {
      id: createAdditionalDeadlineId(),
      label: trimmedLabel,
      date: '',
      completed: false,
    };
    setFormData((prev) => ({
      ...prev,
      additionalDeadlines: [...(prev.additionalDeadlines || []), nextDeadline],
    }));
    setNewDeadlineLabel('');
    toast({
      title: '항목이 추가되었습니다.',
      duration: 1000,
    });
  };

  const handleRemoveDeadlineTemplate = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      additionalDeadlines: (prev.additionalDeadlines || []).filter(
        (deadline) => deadline.id !== id
      ),
    }));
    toast({
      title: '항목이 삭제되었습니다.',
      duration: 1000,
    });
  };

  const handleOwnerPhoneChange = (value: string) => {
    setFormData((prev) => ({ ...prev, ownerPhone: formatPhoneInput(value) }));
  };

  const handlePaybackExpectedChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      paybackExpected: checked,
      paybackExpectedDate: checked ? prev.paybackExpectedDate || prev.dead || '' : '',
      paybackExpectedAmount: checked ? prev.paybackExpectedAmount || 0 : 0,
      paybackConfirmed: checked ? Boolean(prev.paybackConfirmed) : false,
    }));
    if (!checked) {
      setPaybackAmountSameAsCost(false);
    }
  };

  const handlePaybackConfirmedChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      paybackConfirmed: prev.paybackExpected ? checked : false,
    }));
  };

  const handleToggleChannel = (channel: ScheduleChannel) => {
    setFormData((prev) => {
      const current = prev.channel || [];
      const hasChannel = current.includes(channel);
      const nextChannels = hasChannel
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, channel: nextChannels };
    });
  };

  const handleToggleVisitMode = (enabled: boolean) => {
    if (enabled) {
      setNonVisitReviewType((prev) =>
        formData.reviewType && formData.reviewType !== '방문형'
          ? (formData.reviewType as Schedule['reviewType'])
          : prev
      );
    }
    setVisitMode(enabled);
    setFormData((prev) => {
      const nextReviewType: Schedule['reviewType'] = enabled ? '방문형' : nonVisitReviewType;
      const nextStatus = sanitizeStatusForReviewType(
        (prev.status as Schedule['status']) || '선정됨',
        nextReviewType
      );
      const nextChecklist = enabled
        ? prev.visitReviewChecklist || { ...DEFAULT_VISIT_REVIEW_CHECKLIST }
        : undefined;
      return {
        ...prev,
        reviewType: nextReviewType,
        status: nextStatus,
        visitReviewChecklist: nextChecklist,
        ...(enabled ? {} : { visit: '', visitTime: '' }),
      };
    });
  };

  const shouldAutoSaveLocationSelection = Boolean(initialMapSearchAutoSave && schedule);

  const handleMapPlaceSelection = (place: MapPlaceSelection) => {
    const locationUpdate: Partial<Schedule> = {
      region: place.region,
      regionDetail: place.address,
      phone: place.phone || formData.phone,
      lat: place.latitude,
      lng: place.longitude,
    };
    setFormData((prev) => ({ ...prev, ...locationUpdate }));
    setLocationDetailEnabled(true);
    setShowMapSearchModal(false);
    if (shouldAutoSaveLocationSelection) {
      handleSave(locationUpdate);
    }
  };

  const handleManualAddressFallback = () => {
    setLocationDetailEnabled(false);
    setFormData((prev) => ({
      ...prev,
      lat: undefined,
      lng: undefined,
    }));
    setShowMapSearchModal(false);
  };

  const updateVisitChecklist = (
    partial: Partial<NonNullable<Schedule['visitReviewChecklist']>>
  ) => {
    setFormData((prev) => {
      const current = prev.visitReviewChecklist || { ...DEFAULT_VISIT_REVIEW_CHECKLIST };
      return {
        ...prev,
        visitReviewChecklist: { ...current, ...partial },
      };
    });
  };

  const toggleVisitReviewChecklist = (key: VisitReviewToggleKey) => {
    setFormData((prev) => {
      const current = prev.visitReviewChecklist || { ...DEFAULT_VISIT_REVIEW_CHECKLIST };
      const isSelected = Boolean(current[key]);
      const nextChecklist = { ...current, [key]: !isSelected };
      if (key === 'other' && isSelected) {
        nextChecklist.otherText = '';
      }
      return {
        ...prev,
        visitReviewChecklist: nextChecklist,
      };
    });
  };

  const addCustomPlatform = async () => {
    const trimmedPlatform = newPlatform.trim();
    if (!trimmedPlatform) {
      setEmptyPlatformAlert(true);
      return;
    }
    const platformExists = allPlatforms.some(
      (platform) => platform.toLowerCase() === trimmedPlatform.toLowerCase()
    );
    if (platformExists) {
      setDuplicatePlatformAlert(true);
      return;
    }
    const success = await addPlatform(trimmedPlatform);
    if (success) {
      setFormData({ ...formData, platform: trimmedPlatform });
      setNewPlatform('');
      toast({
        title: '플랫폼이 추가되었습니다.',
        duration: 1000,
      });
    }
  };

  const deletePlatform = async (platformName: string) => {
    const success = await removePlatform(platformName);
    if (success) {
      if (formData.platform === platformName) {
        setFormData({ ...formData, platform: '' });
      }
      toast({
        title: '플랫폼이 삭제되었습니다.',
        duration: 1000,
      });
    }
    setPlatformToDelete(null);
  };

  const addCustomChannel = async () => {
    const trimmedChannel = newChannel.trim();
    if (!trimmedChannel) {
      setEmptyChannelAlert(true);
      return;
    }
    const channelExists = allChannels.some(
      (channel) => channel.toLowerCase() === trimmedChannel.toLowerCase()
    );
    if (channelExists) {
      setDuplicateChannelAlert(true);
      return;
    }
    const success = await addScheduleChannel(trimmedChannel);
    if (success) {
      setNewChannel('');
      toast({
        title: '작성할 채널이 추가되었습니다.',
        duration: 1000,
      });
    }
  };

  const deleteChannel = async (channelName: string) => {
    const success = await removeScheduleChannel(channelName);
    if (success) {
      setFormData((prev) => ({
        ...prev,
        channel: (prev.channel || []).filter((item) => item !== channelName),
      }));
      toast({
        title: '작성할 채널이 삭제되었습니다.',
        duration: 1000,
      });
    }
    setChannelToDelete(null);
  };

  const { period, hour, minute } = parseVisitTime(formData.visitTime || '');
  const displayVisitTime = formData.visitTime ? formatKoreanTime(formData.visitTime) : '시간 선택';
  const defaultIncomeDetail = scheduleIncomeDetails.find(isDefaultIncomeDetail);
  const defaultCostDetail = scheduleIncomeDetails.find(isDefaultCostDetail);
  const customIncomeDetails = React.useMemo(
    () =>
      scheduleIncomeDetails.filter(
        (detail) => !isDefaultIncomeDetail(detail) && !isDefaultCostDetail(detail)
      ),
    [scheduleIncomeDetails]
  );
  const activeScheduleDetails = React.useMemo(
    (): ScheduleTransactionItem[] => scheduleIncomeDetails,
    [scheduleIncomeDetails]
  );
  const { incomeTotal, costTotal } = React.useMemo(
    () => sumIncomeDetails(activeScheduleDetails),
    [activeScheduleDetails]
  );
  const totalAssetGain = (formData.benefit || 0) + incomeTotal - costTotal;

  const updateVisitTime = (next: { period?: string; hour?: string; minute?: string }) => {
    const finalPeriod = next.period || period;
    const finalHour = next.hour || hour;
    const finalMinute = next.minute || minute;
    const hourNum = Number(finalHour);
    const hour24 = finalPeriod === '오전' ? hourNum % 12 : hourNum === 12 ? 12 : hourNum + 12;
    const paddedHour = hour24.toString().padStart(2, '0');
    setFormData({ ...formData, visitTime: `${paddedHour}:${finalMinute}` });
  };

  const applyStatusChange = useCallback((value: Schedule['status']) => {
    setFormData((prev) => ({ ...prev, status: value }));
    if (value !== '재확인') {
      setReconfirmReason('');
      setCustomReconfirmReason('');
    }
  }, []);

  const handleStatusChange = (value: Schedule['status']) => {
    applyStatusChange(value);
  };

  useEffect(() => {
    if (formData.visit && formData.visitTime && formData.status === '선정됨') {
      applyStatusChange('방문일 예약 완료');
    }
  }, [formData.visit, formData.visitTime, formData.status, applyStatusChange]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed left-0 w-full flex flex-col justify-end text-neutral-900"
        style={{
          height: viewportStyle.height,
          top: viewportStyle.top,
          zIndex: Z_INDEX.scheduleModal,
        }}
      >
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCloseConfirm(true)}
          style={{ touchAction: 'none' }}
        />

        <div
          className="relative w-full bg-white rounded-t-[30px] flex flex-col shadow-2xl overflow-hidden animate-slide-up text-neutral-900 mx-auto"
          style={{ maxHeight: '90%', maxWidth: '800px' }}
        >
          <button
            onClick={onClose}
            className="absolute right-5 top-4 z-50 flex h-8 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-all hover:bg-neutral-200 hover:text-neutral-900 active:scale-95"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide touch-pan-y min-h-0"
          >
            <div
              className={`px-6 py-5 flex justify-center items-center ${schedule ? 'flex-none' : 'sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]'}`}
            >
              <span className="font-bold text-[16px]">
                {schedule ? '체험단 수정' : '체험단 등록'}
              </span>
            </div>
            {schedule && (
              <div className="sticky top-0 z-40 relative">
                <div className="bg-white/95 px-3 pt-3 pb-2 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div
                    className="flex overflow-x-auto scrollbar-hide bg-neutral-100/80 rounded-full p-1 gap-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSection(basicInfoRef);
                      }}
                      className={`shrink-0 px-2.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                        activeTab === 'basicInfo'
                          ? 'bg-white text-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      기본 정보
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSection(progressInfoRef);
                      }}
                      className={`shrink-0 px-2.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                        activeTab === 'progressInfo'
                          ? 'bg-white text-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      체험 진행
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSection(assetManagementRef);
                      }}
                      className={`shrink-0 px-2.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                        activeTab === 'assetManagement'
                          ? 'bg-white text-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      자산 관리
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSection(memoRef);
                      }}
                      className={`shrink-0 px-2.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                        activeTab === 'memo'
                          ? 'bg-white text-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      메모장
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-4 bg-[#F2F4F6] p-4">
              {formData.dead && formData.dead < getTodayInKST() && formData.status !== '완료' && (
                <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <span className="text-[14px]">⚠️</span>
                  <span className="text-[14px] font-bold text-red-700">
                    마감 기한 초과된 체험단입니다
                  </span>
                </div>
              )}

              <section
                ref={basicInfoRef}
                className="scroll-mt-[70px] rounded-[28px] bg-white px-5 py-6 shadow-[0_10px_25px_rgba(15,23,42,0.08)] space-y-5"
              >
                <div className="space-y-4">
                  <div ref={deadlineSectionRef}>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-0.5">
                      제목 (필수)
                    </label>
                    <p className="text-[12px] text-neutral-400 mb-2.5">업체명을 입력해주세요</p>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => {
                          setFormData({ ...formData, title: e.target.value });
                          if (titleError) {
                            setTitleError(false);
                          }
                        }}
                        className="w-full h-[40px] rounded-[18px] bg-[#F2F4F6] px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none"
                        placeholder="(예: [OO식당] 체험단 방문, XX샴푸 리뷰 등)"
                      />
                      {formData.title && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(formData.title || '');
                            toast({
                              title: '제목이 복사되었습니다.',
                              duration: 1000,
                            });
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                        >
                          <Copy className="w-4 h-4 cursor-pointer" />
                        </button>
                      )}
                      {titleError && (
                        <p className="mt-1 text-[12px] text-red-500">제목을 입력해주세요.</p>
                      )}
                    </div>
                  </div>

                  {/* 당첨가이드 링크 입력 필드 */}
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-0.5">
                      가이드라인 링크
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={purchaseLink}
                        onChange={(e) => setPurchaseLink(e.target.value)}
                        className="w-full h-[40px] rounded-[18px] bg-[#F2F4F6] px-4 pr-12 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none"
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (purchaseLink) {
                            navigator.clipboard.writeText(purchaseLink);
                            toast({
                              title: '링크가 복사되었습니다.',
                              duration: 1000,
                            });
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                        title="복사"
                      >
                        <Copy className="w-4 h-4 cursor-pointer" />
                      </button>
                    </div>
                  </div>

                  {schedule && (
                    <div ref={statusSectionRef} className="space-y-6 scroll-mt-[70px]">
                      <StatusFields
                        value={formData.status as Schedule['status']}
                        reviewType={formData.reviewType}
                        onChange={handleStatusChange}
                        showCompletionOnboarding={showCompletionOnboarding}
                        isEditing={Boolean(schedule)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[15px] font-bold text-[#FF5722] mb-2">
                      마감일 (필수)
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full h-[40px] rounded-[18px] bg-[#F2F4F6] px-4 text-[15px] text-neutral-900 text-left cursor-pointer focus-visible:outline-none">
                          {formData.dead
                            ? format(new Date(formData.dead), 'PPP', { locale: ko })
                            : '날짜 선택'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.dead ? new Date(formData.dead) : undefined}
                          onSelect={(date) => {
                            const nextDead = date ? format(date, 'yyyy-MM-dd') : '';
                            setFormData((prev) => {
                              const shouldSyncPaybackDate =
                                prev.paybackExpected &&
                                (prev.paybackExpectedDate === '' ||
                                  prev.paybackExpectedDate === (prev.dead || ''));
                              return {
                                ...prev,
                                dead: nextDead,
                                paybackExpectedDate: shouldSyncPaybackDate
                                  ? nextDead
                                  : prev.paybackExpectedDate,
                              };
                            });
                            if (date && deadlineError) {
                              setDeadlineError(false);
                            }
                          }}
                          locale={ko}
                        />
                      </PopoverContent>
                    </Popover>
                    {deadlineError && (
                      <p className="mt-1 text-[12px] text-red-500">마감일을 선택해주세요.</p>
                    )}
                  </div>

                  {(formData.additionalDeadlines || []).length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-orange-50/30 border border-orange-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="">📋 </span>
                        <span className="text-[13px] font-bold text-orange-700">
                          세부 일정 관리
                        </span>
                      </div>
                      <div className="space-y-3">
                        {(formData.additionalDeadlines || []).map((deadline) => {
                          const hasDeadline = Boolean(deadline?.date);
                          const isCompleted = deadline?.completed === true;
                          return (
                            <div key={deadline.id}>
                              <label
                                className={`block text-[14px] font-semibold mb-2 ${
                                  isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-700'
                                }`}
                              >
                                {deadline.label}
                              </label>
                              <div className="flex items-center gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      className={`flex-1 h-[40px] rounded-[18px] px-4 text-[15px] text-left cursor-pointer focus-visible:outline-none transition-colors ${
                                        isCompleted
                                          ? 'bg-neutral-100 text-neutral-400'
                                          : 'bg-white text-neutral-900 border border-neutral-200'
                                      }`}
                                    >
                                      {deadline?.date
                                        ? format(new Date(deadline.date), 'PPP', {
                                            locale: ko,
                                          })
                                        : '날짜 선택'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={
                                        deadline?.date ? new Date(deadline.date) : undefined
                                      }
                                      onSelect={(date) => {
                                        if (date) {
                                          setFormData((prev) => ({
                                            ...prev,
                                            additionalDeadlines: (
                                              prev.additionalDeadlines || []
                                            ).map((item) =>
                                              item.id === deadline.id
                                                ? { ...item, date: format(date, 'yyyy-MM-dd') }
                                                : item
                                            ),
                                          }));
                                          return;
                                        }
                                        setFormData((prev) => ({
                                          ...prev,
                                          additionalDeadlines: (prev.additionalDeadlines || []).map(
                                            (item) =>
                                              item.id === deadline.id ? { ...item, date: '' } : item
                                          ),
                                        }));
                                      }}
                                      locale={ko}
                                    />
                                  </PopoverContent>
                                </Popover>
                                {hasDeadline && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        additionalDeadlines: (prev.additionalDeadlines || []).map(
                                          (item) =>
                                            item.id === deadline.id
                                              ? { ...item, completed: !item.completed }
                                              : item
                                        ),
                                      }));
                                    }}
                                    className={`flex items-center gap-1.5 px-3 h-[40px] rounded-[18px] transition-all active:scale-95 font-semibold text-[13px] ${
                                      isCompleted
                                        ? 'bg-orange-400 text-white shadow-sm'
                                        : 'bg-white text-neutral-600 border border-neutral-200 hover:border-orange-300'
                                    }`}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      className="inline-block"
                                    >
                                      <circle
                                        cx="10"
                                        cy="10"
                                        r="8"
                                        stroke={isCompleted ? 'white' : '#d1d5db'}
                                        strokeWidth="2"
                                        fill={isCompleted ? 'white' : 'transparent'}
                                      />
                                      {isCompleted && (
                                        <path
                                          d="M6 10.5l2.5 2.5 5-5"
                                          stroke="#f97316"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      )}
                                    </svg>
                                    <span>{isCompleted ? '완료' : '완료'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDeadlineTemplate(deadline.id)}
                                  className="flex items-center gap-1 px-2.5 h-[40px] rounded-[18px] bg-white text-neutral-500 border border-neutral-200 hover:border-red-300 hover:text-red-600 transition-all active:scale-95 font-semibold text-[13px]"
                                  title="일정 삭제"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeadlineManagement(true);
                        }}
                        className={MANAGE_BUTTON_CLASS}
                      >
                        +<span>할 일 추가하기</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section
                ref={progressInfoRef}
                className="scroll-mt-[70px] rounded-[28px] bg-white px-5 py-6 shadow-[0_10px_25px_rgba(15,23,42,0.08)] space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[16px] font-semibold text-neutral-900 mb-0.5">
                      체험 진행 정보
                    </p>
                  </div>
                  <p className="text-[12px] text-neutral-400">
                    리뷰 채널과 방문 정보를 손쉽게 입력해 보세요.
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                      플랫폼
                    </label>
                    <div className="rounded-[24px] bg-white/90">
                      <div className="flex flex-wrap gap-2">
                        {platformOptions.map((platform) => {
                          const isActive = formData.platform === platform;
                          return (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => setFormData({ ...formData, platform })}
                              className={`text-[12px] px-3.5 py-1.5 rounded-[16px] font-semibold transition-colors ${
                                isActive
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-[#F2F4F6] text-[#4E5968]'
                              }`}
                            >
                              {platform}
                            </button>
                          );
                        })}
                        {platformOptions.length === 0 && (
                          <span className="text-sm text-neutral-400">플랫폼을 추가해주세요.</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPlatformManagement(true)}
                          className={MANAGE_BUTTON_CLASS}
                        >
                          +<span>플랫폼 관리</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                      카테고리
                    </label>
                    <div className="rounded-[24px] bg-white/90">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedCategories.length > 0 ? (
                          selectedCategories.map((category) => {
                            const meta = CATEGORY_OPTIONS.find((c) => c.value === category);
                            const isActive = formData.category === category;
                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, category }))}
                                className={`px-3.5 py-1.5 rounded-[16px] text-[12px] font-semibold transition-colors ${
                                  isActive
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-[#F2F4F6] text-[#4E5968]'
                                }`}
                              >
                                <span className="truncate max-w-[120px]">
                                  {meta?.label || category}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-xs text-neutral-400">
                            표시할 카테고리를 선택하세요.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowCategoryManagement(true)}
                          className={MANAGE_BUTTON_CLASS}
                        >
                          +<span>카테고리 관리</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                        리뷰 채널 (복수 선택 가능)
                      </label>
                      <div className="rounded-[24px] bg-white/90">
                        <div className="flex flex-wrap gap-2">
                          {channelOptions.map((channel) => {
                            const isSelected = (formData.channel || []).includes(channel);
                            return (
                              <button
                                key={channel}
                                type="button"
                                onClick={() => handleToggleChannel(channel)}
                                className={`text-[12px] px-3 py-1 rounded-[16px] font-semibold transition-colors ${
                                  isSelected
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-[#F2F4F6] text-[#4E5968]'
                                }`}
                              >
                                {channel}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setShowChannelManagement(true)}
                            className={MANAGE_BUTTON_CLASS}
                          >
                            +<span>채널 관리</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[16px] font-semibold text-neutral-900">
                          방문 일정이 있나요?
                        </p>
                        <p className="text-[12px] text-neutral-400">
                          토글을 켜면 방문 정보 입력란이 추가돼요.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleVisitMode(!visitMode)}
                        className={`relative h-8 w-16 rounded-full transition ${visitMode ? 'bg-orange-400' : 'bg-neutral-300'}`}
                        aria-pressed={visitMode}
                      >
                        <span
                          className={`absolute top-[4px] h-6 w-7 rounded-full bg-white shadow transition ${visitMode ? 'right-[3px]' : 'left-[3px]'}`}
                        />
                      </button>
                    </div>
                    {!visitMode && (
                      <div className="mt-4">
                        <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                          사장님(광고주) 전화번호
                        </p>
                        <div className="relative">
                          <input
                            type="tel"
                            value={formData.ownerPhone || ''}
                            onChange={(e) => handleOwnerPhoneChange(e.target.value)}
                            placeholder="예: 010-9876-5432"
                            className="w-full rounded-[18px] bg-[#F7F7F8] px-4 py-2 text-[15px] text-neutral-900 focus-visible:outline-none"
                          />
                          {formData.ownerPhone && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(formData.ownerPhone || '');
                                toast({
                                  title: '사장님 전화번호가 복사되었습니다.',
                                  duration: 1000,
                                });
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                            >
                              <Copy className="w-4 h-4 cursor-pointer" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {visitMode && (
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-[15px] font-semibold text-neutral-500 mb-3">
                                방문일
                              </p>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full rounded-[18px] bg-[#F2F4F6] px-4 py-2 text-[16px] font-semibold text-neutral-900 text-left">
                                    {formData.visit
                                      ? format(new Date(formData.visit), 'PPP', { locale: ko })
                                      : '날짜 선택'}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={formData.visit ? new Date(formData.visit) : undefined}
                                    onSelect={(date) =>
                                      setFormData({
                                        ...formData,
                                        visit: date ? format(date, 'yyyy-MM-dd') : '',
                                      })
                                    }
                                    locale={ko}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                                방문시간
                              </p>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full rounded-[18px] bg-[#F2F4F6] px-4 py-2 text-[16px] font-semibold text-neutral-900 text-left">
                                    {displayVisitTime}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-3" align="start">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-neutral-500">
                                        오전/오후
                                      </span>
                                      <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                                        <div className="p-1 space-y-1">
                                          {TIME_OPTIONS.periods.map((p) => (
                                            <button
                                              key={p}
                                              className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-left cursor-pointer transition-colors ${
                                                p === period
                                                  ? 'bg-blue-500 text-white'
                                                  : 'hover:bg-neutral-100 text-neutral-800'
                                              }`}
                                              onClick={() => updateVisitTime({ period: p })}
                                            >
                                              {p}
                                            </button>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-neutral-500">
                                        시
                                      </span>
                                      <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                                        <div className="p-1 grid grid-cols-2 gap-1">
                                          {TIME_OPTIONS.hours.map((h) => (
                                            <button
                                              key={h}
                                              className={`rounded-md px-2 py-2 text-sm font-semibold text-center cursor-pointer transition-colors ${
                                                h === hour
                                                  ? 'bg-blue-500 text-white'
                                                  : 'hover:bg-neutral-100 text-neutral-800'
                                              }`}
                                              onClick={() => updateVisitTime({ hour: h })}
                                            >
                                              {h}
                                            </button>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-neutral-500">
                                        분
                                      </span>
                                      <ScrollArea className="h-44 rounded-lg border border-neutral-200 bg-white">
                                        <div className="p-1 grid grid-cols-2 gap-1">
                                          {TIME_OPTIONS.minutes.map((m) => (
                                            <button
                                              key={m}
                                              className={`rounded-md px-2 py-2 text-sm font-semibold text-center cursor-pointer transition-colors ${
                                                m === minute
                                                  ? 'bg-blue-500 text-white'
                                                  : 'hover:bg-neutral-100 text-neutral-800'
                                              }`}
                                              onClick={() => updateVisitTime({ minute: m })}
                                            >
                                              {m}
                                            </button>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div>
                            <p className="text-[15px] font-semibold text-neutral-500 mb-2">위치</p>
                            <div className="space-y-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={formData.region || ''}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setFormData((prev) => ({
                                      ...prev,
                                      region: nextValue,
                                      regionDetail: '',
                                      lat: undefined,
                                      lng: undefined,
                                    }));
                                    setLocationDetailEnabled(false);
                                  }}
                                  placeholder="주소를 입력해 주세요"
                                  className="w-full h-10 rounded-[18px] border border-neutral-200 bg-[#F2F4F6] px-4 pr-20 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none"
                                />
                                {formData.region && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(formData.region || '');
                                      toast({
                                        title: '위치가 복사되었습니다.',
                                        duration: 1000,
                                      });
                                    }}
                                    className="absolute right-18 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                  >
                                    <Copy className="w-4 h-4 cursor-pointer" />
                                  </button>
                                )}
                                <div className="absolute inset-y-0 -right-3 flex items-center gap-2 pr-4">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowMapSearchModal(true);
                                    }}
                                    className="flex items-center gap-1 pr-4 text-neutral-500"
                                  >
                                    <Search className="h-5 w-5 text-orange-500" />
                                    <span className="text-[13px] font-semibold text-orange-500">
                                      검색
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {locationDetailEnabled && (
                            <div>
                              <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                                위치 상세
                              </p>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={formData.regionDetail || ''}
                                  onChange={(e) =>
                                    setFormData({ ...formData, regionDetail: e.target.value })
                                  }
                                  placeholder="예: 4층 스튜디오 / 사무실 앞 벤치"
                                  className="w-full h-10 rounded-[18px] bg-[#F2F4F6] px-4 pr-12 text-[15px] text-neutral-900 focus-visible:outline-none"
                                />
                                {formData.regionDetail && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(formData.regionDetail || '');
                                      toast({
                                        title: '위치 상세가 복사되었습니다.',
                                        duration: 1000,
                                      });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                  >
                                    <Copy className="w-4 h-4 cursor-pointer" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-4">
                            <div>
                              <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                                가게 전화번호
                              </p>
                              <div className="relative">
                                <input
                                  type="tel"
                                  value={formData.phone || ''}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      phone: formatPhoneInput(e.target.value),
                                    })
                                  }
                                  placeholder="예: 02-123-4567"
                                  className="w-full rounded-[18px] bg-[#F7F7F8] px-4 py-2 text-[15px] text-neutral-900 focus-visible:outline-none"
                                />
                                {formData.phone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(formData.phone || '');
                                      toast({
                                        title: '가게 전화번호가 복사되었습니다.',
                                        duration: 1000,
                                      });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                  >
                                    <Copy className="w-4 h-4 cursor-pointer" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                                사장님 전화번호
                              </p>
                              <div className="relative">
                                <input
                                  type="tel"
                                  value={formData.ownerPhone || ''}
                                  onChange={(e) => handleOwnerPhoneChange(e.target.value)}
                                  placeholder="예: 010-9876-5432"
                                  className="w-full rounded-[18px] bg-[#F7F7F8] px-4 py-2 text-[15px] text-neutral-900 focus-visible:outline-none"
                                />
                                {formData.ownerPhone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(formData.ownerPhone || '');
                                      toast({
                                        title: '사장님 전화번호가 복사되었습니다.',
                                        duration: 1000,
                                      });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                                  >
                                    <Copy className="w-4 h-4 cursor-pointer" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[15px] font-semibold text-neutral-500 mb-2">
                              방문 후 추가 리뷰
                            </p>
                            <div className="space-y-2">
                              {VISIT_REVIEW_OPTIONS.map((option) => {
                                const isSelected = Boolean(
                                  formData.visitReviewChecklist?.[option.key]
                                );
                                return (
                                  <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => toggleVisitReviewChecklist(option.key)}
                                    className={`w-full h-[38px] rounded-[18px] border px-4 py-3 flex items-center justify-between transition ${
                                      isSelected
                                        ? 'border-orange-400'
                                        : 'border-[#E5E8EB] bg-white hover:border-neutral-300'
                                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/40`}
                                  >
                                    <span
                                      className={`text-[14px] ${
                                        isSelected
                                          ? 'text-neutral-900 font-semibold'
                                          : 'text-neutral-600'
                                      }`}
                                    >
                                      {option.label}
                                    </span>
                                    <span
                                      className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border ${
                                        isSelected
                                          ? 'border-orange-400 bg-orange-400'
                                          : 'border-neutral-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            {formData.visitReviewChecklist?.other && (
                              <input
                                type="text"
                                value={formData.visitReviewChecklist?.otherText || ''}
                                onChange={(e) =>
                                  updateVisitChecklist({
                                    other: true,
                                    otherText: e.target.value,
                                  })
                                }
                                className="w-full h-[40px] rounded-[16px] bg-[#F9FAFB] px-4 py-3 text-[16px] text-neutral-900 focus-visible:outline-none placeholder:text-neutral-400"
                                placeholder="추가 리뷰를 입력하세요"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section
                ref={assetManagementRef}
                className="scroll-mt-[70px] rounded-[28px] bg-white px-5 py-6 shadow-[0_10px_25px_rgba(15,23,42,0.08)] space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-[16px] font-semibold text-neutral-900">자산 관리</label>
                    <p className="text-[11px] text-neutral-400">
                      제공(물품) + 현금 - 내가 쓴 돈 = 수익
                    </p>
                  </div>
                </div>
                <div className="rounded-[20px] bg-[#EFF5FF] px-4 py-4 space-y-1">
                  <label className="flex items-center justify-between text-[14px] font-semibold text-neutral-600">
                    <span>{BENEFIT_FIELD.label}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(formData.benefit || 0)}
                      onChange={(e) => handleNumberChange('benefit', e.target.value)}
                      className="mb-1 w-[120px] rounded-full border border-transparent bg-white/80 px-3 py-[2px] text-right text-[12px] font-semibold text-neutral-900 focus-visible:border-orange-300 focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex items-center justify-between text-[14px] font-semibold text-neutral-600">
                    <span>{DEFAULT_INCOME_LABEL}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(defaultIncomeDetail?.amount || 0)}
                      onChange={(e) =>
                        defaultIncomeDetail
                          ? handleIncomeDetailChange(defaultIncomeDetail.id, {
                              amount: parseNumber(e.target.value),
                            })
                          : undefined
                      }
                      className="mb-1 w-[120px] rounded-full border border-transparent bg-white/80 px-3 py-[2px] text-right text-[12px] font-semibold text-neutral-900 focus-visible:border-orange-300 focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex items-center justify-between text-[14px] font-semibold text-neutral-600">
                    <span>{DEFAULT_COST_LABEL}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(defaultCostDetail?.amount || 0)}
                      onChange={(e) =>
                        defaultCostDetail
                          ? handleIncomeDetailChange(defaultCostDetail.id, {
                              amount: parseNumber(e.target.value),
                            })
                          : undefined
                      }
                      className="mb-1 w-[120px] rounded-full border border-transparent bg-white/80 px-3 py-[2px] text-right text-[12px] font-semibold text-neutral-900 focus-visible:border-orange-300 focus-visible:outline-none"
                    />
                  </label>
                  {customIncomeDetails.length > 0 && (
                    <div
                      ref={customIncomeListRef}
                      className="mt-2 mb-3 scroll-mt-4 rounded-[16px] bg-white/80 px-3.5 py-2.5 border border-white/70 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                    >
                      <p className="text-[12px] font-semibold text-neutral-500 mb-2">
                        추가 항목 {customIncomeDetails.length}개
                      </p>
                      <div className="space-y-2">
                        {customIncomeDetails.map((detail) => (
                          <div
                            key={detail.id}
                            className="flex items-center justify-between gap-2 rounded-[14px] bg-white/90 text-[13px] font-semibold text-neutral-600"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  detail.type === 'EXPENSE'
                                    ? 'bg-[#fee2e2]/70 text-[#ef4444]'
                                    : 'bg-[#eef5ff] text-[#2563eb]'
                                }`}
                              >
                                {detail.type === 'EXPENSE' ? '지출' : '수익'}
                              </span>
                              <span className="min-w-0 truncate">{detail.label}</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatNumber(detail.amount || 0)}
                                onChange={(e) =>
                                  handleIncomeDetailChange(detail.id, {
                                    amount: parseNumber(e.target.value),
                                  })
                                }
                                className="h-[30px] w-[104px] rounded-full border border-neutral-200 bg-white/80 px-3 py-[2px] text-right text-[12px] font-semibold text-neutral-900 focus-visible:border-orange-300 focus-visible:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveScheduleIncomeDetail(detail.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                aria-label="내역 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2.5 text-[12px] text-neutral-500">
                        입력한 내역은 통계에서 가계부처럼 한눈에 관리할 수 있어요.
                      </p>
                    </div>
                  )}
                  <p className="text-[13px] font-bold text-neutral-600 tracking-tight text-right">
                    총 {formatNumber(totalAssetGain)}원 경제적 가치
                  </p>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowIncomeDetailManagement((prev) => !prev)}
                      className={MANAGE_BUTTON_CLASS}
                    >
                      +
                      <span>
                        {showIncomeDetailManagement ? '내역 입력 닫기' : '내역 직접 입력하기'}
                      </span>
                    </button>
                  </div>
                  {showIncomeDetailManagement && (
                    <div className="mt-3 rounded-[26px] border border-neutral-200/70 bg-white/95 px-4 py-4 space-y-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      <p className="text-[12px] text-neutral-400">
                        사용 방법: 수익/지출 선택 → 내역 이름 → 금액 입력
                      </p>
                      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_120px]">
                        <Select
                          value={newIncomeDetailType}
                          onValueChange={(value) =>
                            setNewIncomeDetailType(value as ScheduleTransactionItem['type'])
                          }
                        >
                          <SelectTrigger className="h-11 w-full min-w-0 rounded-2xl bg-white/80 border border-[#EDEDED] text-[14px] font-semibold text-neutral-700 shadow-[0_6px_16px_rgba(15,23,42,0.06)] focus-visible:border-orange-200">
                            <SelectValue placeholder="유형" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">수익</SelectItem>
                            <SelectItem value="EXPENSE">지출</SelectItem>
                          </SelectContent>
                        </Select>
                        <input
                          type="text"
                          value={newIncomeDetailLabel}
                          onChange={(e) => setNewIncomeDetailLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddIncomeDetailFromModal();
                          }}
                          className="h-11 w-full min-w-0 px-4 bg-white/80 border border-[#EDEDED] rounded-2xl text-[15px] shadow-[0_6px_16px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/30 focus-visible:border-orange-200"
                          placeholder="내역 이름 (예: 주차비, 배송비)"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newIncomeDetailAmount}
                          onChange={(e) =>
                            setNewIncomeDetailAmount(formatAmountInput(e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddIncomeDetailFromModal();
                          }}
                          className="h-11 w-full min-w-0 px-4 bg-white/80 border border-[#EDEDED] rounded-2xl text-[15px] text-right shadow-[0_6px_16px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]/30 focus-visible:border-orange-200"
                          placeholder="금액"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddIncomeDetailFromModal}
                        className="group w-full h-11 rounded-2xl text-[14px] font-semibold text-white bg-gradient-to-r from-[#FF7A00] via-[#FF6A00] to-[#FF4D00] transition-all hover:brightness-105 active:scale-[0.99]"
                      >
                        추가
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-3 border-t border-neutral-200/80">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={formData.paybackExpected || false}
                      onCheckedChange={(checked) => handlePaybackExpectedChange(Boolean(checked))}
                      className="mt-[5px]"
                    />
                    <div className="min-w-0">
                      <span className="text-[14px] font-semibold text-neutral-900">
                        광고주에게 돌려받아야 할 돈이 있나요?
                      </span>
                      <p className="text-[12px] text-orange-400">
                        입금 확인 전까지 달력에 💸 표시로 잊지 않게 알려드려요.
                      </p>
                    </div>
                  </label>
                  {formData.paybackExpected && (
                    <div className="pl-8 space-y-5 mt-3">
                      <div>
                        <label className="block text-[13px] font-semibold text-neutral-800 mb-1.5">
                          입금예정일 (페이백)
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="w-full h-[40px] rounded-[18px] bg-white border border-neutral-200 px-4 text-[14px] text-neutral-900 text-left cursor-pointer focus-visible:outline-none">
                              {formData.paybackExpectedDate
                                ? format(new Date(formData.paybackExpectedDate), 'PPP', {
                                    locale: ko,
                                  })
                                : formData.dead
                                  ? format(new Date(formData.dead), 'PPP', { locale: ko })
                                  : '날짜 선택'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                formData.paybackExpectedDate
                                  ? new Date(formData.paybackExpectedDate)
                                  : formData.dead
                                    ? new Date(formData.dead)
                                    : undefined
                              }
                              onSelect={(date) => {
                                const next = date ? format(date, 'yyyy-MM-dd') : '';
                                setFormData((prev) => ({
                                  ...prev,
                                  paybackExpectedDate: next,
                                }));
                              }}
                              locale={ko}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="block text-[13px] font-semibold text-neutral-800 mb-1.5">
                          입금예정금액
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumber(formData.paybackExpectedAmount || 0)}
                          onChange={(e) => {
                            if (paybackAmountSameAsCost) {
                              setPaybackAmountSameAsCost(false);
                            }
                            setFormData((prev) => ({
                              ...prev,
                              paybackExpectedAmount: parseNumber(e.target.value),
                            }));
                          }}
                          className="w-full h-[40px] rounded-[18px] bg-white border border-neutral-200 px-4 text-[14px] text-neutral-900 text-left focus-visible:outline-none"
                          placeholder="0"
                        />
                        <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-neutral-700">
                          <Checkbox
                            checked={paybackAmountSameAsCost}
                            onCheckedChange={(checked) => {
                              const nextChecked = Boolean(checked);
                              setPaybackAmountSameAsCost(nextChecked);
                              if (nextChecked) {
                                const costAmount =
                                  scheduleIncomeDetails.find(isDefaultCostDetail)?.amount || 0;
                                setFormData((prev) => ({
                                  ...prev,
                                  paybackExpectedAmount: costAmount,
                                }));
                              }
                            }}
                          />
                          <span>내가 쓴 돈의 금액과 같아요</span>
                        </label>
                      </div>
                      <div className="rounded-[18px] border border-neutral-200 bg-white px-4 py-3 mt-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-neutral-900">
                              입금 확인 (정산 완료)
                            </p>
                            <p className="text-[12px] text-neutral-500">
                              입금이 완료되면 달력의 💸 표시가 사라져요.
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-2 sm:justify-start">
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                formData.paybackConfirmed
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-neutral-100 text-neutral-500'
                              }`}
                            >
                              {formData.paybackConfirmed ? '완료' : '미완료'}
                            </span>
                            <Switch
                              className="shrink-0"
                              checked={formData.paybackConfirmed || false}
                              onCheckedChange={(checked) =>
                                handlePaybackConfirmedChange(Boolean(checked))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <section
                ref={memoRef}
                className="scroll-mt-[70px] rounded-[28px] bg-white px-5 py-6 shadow-[0_10px_25px_rgba(15,23,42,0.08)] space-y-3"
              >
                <p className="text-[16px] font-semibold text-neutral-900">메모장</p>
                <div className="relative">
                  <textarea
                    ref={memoTextareaRef}
                    value={formData.memo || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, memo: e.target.value });
                      autoResizeTextarea();
                    }}
                    placeholder="가이드라인 복사 붙여넣기..."
                    className="w-full rounded-[12px] bg-[#F9FAFB] pl-4 pr-10 py-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3182F6]/40 transition-colors resize-none overflow-hidden min-h-[120px]"
                  />
                  {formData.memo && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.memo || '');
                        toast({
                          title: '메모가 복사되었습니다.',
                          duration: 1000,
                        });
                      }}
                      className="absolute right-1.5 top-3 p-2 text-neutral-400 hover:text-[#FF5722] transition-colors"
                    >
                      <Copy className="w-4 h-4 cursor-pointer" />
                    </button>
                  )}
                </div>
              </section>

              {!visitMode && <></>}
            </div>
            {formData.guideFiles && formData.guideFiles.length > 0 && (
              <div ref={guideFilesSectionRef}>
                <GuideFilesSection
                  guideFiles={formData.guideFiles}
                  guideFilePreviews={guideFilePreviews}
                  onDownload={handleDownloadFile}
                  onRequestDelete={(file, index) => setFileToDelete({ file, index })}
                />
              </div>
            )}
          </div>

          <div
            className="flex-none p-4 bg-white border-t border-neutral-100 pb-safe"
            style={{ zIndex: Z_INDEX.modal }}
          >
            {schedule ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isUploading || isSubmitting}
                  className="flex-2 h-14 px-6 bg-red-50 text-red-600 border border-red-200 font-bold text-base rounded-2xl hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  삭제
                </button>
                <button
                  onClick={() => handleSave()}
                  disabled={isUploading || isSubmitting}
                  className="flex-8 h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl hover:bg-[#FF5722]/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    '저장'
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSave()}
                disabled={isUploading || isSubmitting}
                className="w-full h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl hover:bg-[#FF5722]/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
            )}
          </div>

          {/* 항상 표시되는 플로팅 버튼 - schedule(체험단 수정)일 때만 표시 */}
          {schedule && (
            <div className="absolute bottom-[90px] right-5 z-50 flex flex-col gap-2 pointer-events-none">
              <button
                onClick={scrollToTop}
                className="pointer-events-auto rounded-full bg-white/90 p-2.5 shadow-lg border border-neutral-100 transition-all hover:bg-white active:scale-95"
              >
                <ArrowUp className="w-5 h-5 text-neutral-600" />
              </button>
              <button
                onClick={scrollToBottom}
                className="pointer-events-auto rounded-full bg-white/90 p-2.5 shadow-lg border border-neutral-100 transition-all hover:bg-white active:scale-95"
              >
                <ArrowDown className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 나머지 모달들 (Platform, Channel, Confirm 등) 코드 생략 없이 유지 */}
      {showPlatformManagement && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPlatformManagement(false)}
            style={{ zIndex: Z_INDEX.managementBackdrop }}
          />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-[70%] bg-white rounded-t-[30px] flex flex-col animate-slide-up"
            style={{ zIndex: Z_INDEX.managementModal, maxWidth: '800px' }}
          >
            <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-[16px]">플랫폼 관리</span>
              <button
                onClick={() => setShowPlatformManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-6">
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                  새 플랫폼 추가
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
                    placeholder="새 플랫폼 이름"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomPlatform()}
                  />
                  <button
                    onClick={addCustomPlatform}
                    disabled={profileLoading}
                    className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                  등록된 플랫폼
                </label>
                {profileLoading ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    불러오는 중...
                  </div>
                ) : allPlatforms.length === 0 ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    등록된 플랫폼이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPlatforms.map((platform) => (
                      <div
                        key={platform}
                        className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
                      >
                        <span className="text-[15px] font-medium">{platform}</span>
                        <button
                          onClick={() => {
                            setPlatformToDelete(platform);
                            setShowPlatformManagement(false);
                          }}
                          className="text-red-600 hover:text-red-700 font-semibold text-[15px] cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showChannelManagement && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowChannelManagement(false)}
            style={{ zIndex: Z_INDEX.managementBackdrop }}
          />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-[70%] bg-white rounded-t-[30px] flex flex-col animate-slide-up"
            style={{ zIndex: Z_INDEX.managementModal, maxWidth: '800px' }}
          >
            <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-[16px]">작성할 채널 관리</span>
              <button
                onClick={() => setShowChannelManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-6">
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                  작성할 채널 추가
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
                    placeholder="작성할 채널 이름"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomChannel()}
                  />
                  <button
                    onClick={addCustomChannel}
                    disabled={profileLoading}
                    className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                  등록된 작성할 채널
                </label>
                {profileLoading ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    불러오는 중...
                  </div>
                ) : allChannels.length === 0 ? (
                  <div className="text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    등록된 작성할 채널이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allChannels.map((channel) => (
                      <div
                        key={channel}
                        className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
                      >
                        <span className="text-[15px] font-medium truncate">{channel}</span>
                        <button
                          onClick={() => {
                            setChannelToDelete(channel);
                            setShowChannelManagement(false);
                          }}
                          className="text-red-600 hover:text-red-700 font-semibold text-[15px] cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showCategoryManagement && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCategoryManagement(false)}
            style={{ zIndex: Z_INDEX.managementBackdrop }}
          />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-[70%] bg-white rounded-t-[30px] flex flex-col animate-slide-up"
            style={{ zIndex: Z_INDEX.managementModal, maxWidth: '800px' }}
          >
            <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-base">카테고리 관리</span>
              <button
                onClick={() => setShowCategoryManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const isActive = selectedCategories.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleCategory(option.value)}
                      className={`w-full flex items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-orange-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <span className="text-sm">{option.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-neutral-900 whitespace-normal leading-snug">
                          {option.label}
                        </div>
                        <div className="text-[11px] text-neutral-500 whitespace-normal leading-snug">
                          {option.description}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                          isActive
                            ? 'bg-[#FF5722] text-white'
                            : 'border border-neutral-300 text-transparent'
                        }`}
                        aria-hidden
                      >
                        ✓
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Alert Dialogs (삭제, 중복, 확인 등) */}
      <AlertDialog
        open={platformToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPlatformToDelete(null);
            setShowPlatformManagement(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>플랫폼 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{platformToDelete}&apos; 플랫폼을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => platformToDelete && deletePlatform(platformToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicatePlatformAlert} onOpenChange={setDuplicatePlatformAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              중복된 플랫폼
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이미 존재하는 플랫폼입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setDuplicatePlatformAlert(false)}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyPlatformAlert} onOpenChange={setEmptyPlatformAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              플랫폼 이름 입력
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              플랫폼 이름을 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setEmptyPlatformAlert(false)}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={channelToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setChannelToDelete(null);
            setShowChannelManagement(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성할 채널 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &apos;{channelToDelete}&apos; 작성할 채널을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => channelToDelete && deleteChannel(channelToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicateChannelAlert} onOpenChange={setDuplicateChannelAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              중복된 작성할 채널
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이미 존재하는 작성할 채널입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setDuplicateChannelAlert(false)}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyChannelAlert} onOpenChange={setEmptyChannelAlert}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              작성할 채널 이름 입력
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              작성할 채널 이름을 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogAction
              onClick={() => setEmptyChannelAlert(false)}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showCloseConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowCloseConfirm(false);
          }
        }}
      >
        <AlertDialogContent className="w-[320px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              작성 중인 체험단을 닫을까요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              작성한 정보는 저장되지 않습니다. 계속해서 닫으시겠어요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCloseConfirm(false);
                onClose();
              }}
              className="h-10 px-6 text-sm font-bold bg-[#FF5722] hover:bg-[#FF5722]/90 rounded-xl shadow-sm"
            >
              닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="w-[280px] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              체험단 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              이 체험단을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (schedule) {
                  onDelete(schedule.id);
                  setShowDeleteConfirm(false);
                  toast({
                    title: '체험단이 삭제되었습니다.',
                    duration: 1000,
                  });
                }
              }}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => !open && setFileToDelete(null)}
      >
        <AlertDialogContent className="w-[340px] max-w-[90vw] rounded-2xl p-6 gap-4">
          <AlertDialogHeader className="space-y-2 text-center">
            <AlertDialogTitle className="text-base font-bold text-neutral-900">
              파일 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-600 leading-relaxed">
              &apos;{fileToDelete?.file.name}&apos; 파일을 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-2">
            <AlertDialogCancel className="h-10 px-6 text-sm font-bold rounded-xl shadow-sm">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteUploadedFile(fileToDelete.file, fileToDelete.index);
                }
              }}
              className="h-10 px-6 text-sm font-bold bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NaverMapSearchModal
        isOpen={showMapSearchModal}
        onClose={() => setShowMapSearchModal(false)}
        onSelectPlace={handleMapPlaceSelection}
        onManualEntryRequest={handleManualAddressFallback}
      />

      {showDeadlineManagement && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDeadlineManagement(false)}
            style={{ zIndex: Z_INDEX.managementBackdrop }}
          />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-auto max-h-[60%] bg-white rounded-t-[30px] flex flex-col animate-slide-up"
            style={{ zIndex: Z_INDEX.managementModal, maxWidth: '800px' }}
          >
            <div className="relative px-6 py-5 border-b border-neutral-100 flex justify-center items-center flex-shrink-0">
              <span className="font-bold text-[16px]">세부 할 일 관리</span>
              <button
                onClick={() => setShowDeadlineManagement(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div>
                <label className="block text-[15px] font-bold text-neutral-500 mb-1">
                  새로운 할 일
                </label>
                <p className="text-[13px] text-neutral-500 mb-3">
                  등록하면 캘린더에도 표시돼요. 놓치지 않게 챙겨드릴게요!
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeadlineLabel}
                    onChange={(e) => setNewDeadlineLabel(e.target.value)}
                    onCompositionStart={() => {
                      deadlineComposingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                      deadlineComposingRef.current = false;
                      if (deadlineSubmitPendingRef.current) {
                        deadlineSubmitPendingRef.current = false;
                        handleAddDeadlineTemplate();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (deadlineComposingRef.current || e.nativeEvent.isComposing) {
                          deadlineSubmitPendingRef.current = true;
                          return;
                        }
                        handleAddDeadlineTemplate();
                      }
                    }}
                    className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
                    placeholder="예: 초안 제출일, 수정본 제출일, 제품 구매"
                  />
                  <button
                    type="button"
                    onClick={handleAddDeadlineTemplate}
                    className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-bold text-neutral-500 mb-2">
                  등록된 일정
                </label>
                {(formData.additionalDeadlines || []).length === 0 ? (
                  <div className="text-[15px] text-center text-neutral-400 py-10 bg-neutral-50 rounded-xl">
                    등록된 일정이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(formData.additionalDeadlines || []).map((deadline) => (
                      <div
                        key={deadline.id}
                        className="flex items-center gap-3 px-4 py-3 bg-neutral-50 rounded-xl"
                      >
                        <span className="flex-1 text-[14px] font-semibold text-neutral-700">
                          {deadline.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeadlineTemplate(deadline.id)}
                          className="text-red-600 hover:text-red-700 font-semibold text-[14px] cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
