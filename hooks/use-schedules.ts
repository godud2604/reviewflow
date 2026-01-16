'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { Schedule, AdditionalDeadline } from '@/types';
import type { DbSchedule } from '@/types/database';
import { parseStoredChannels, stringifyChannels } from '@/lib/schedule-channels';

interface UseSchedulesOptions {
  enabled?: boolean;
  offset?: number;
  limit?: number;
  selectedDate?: string | null;
  month?: string; // YYYY-MM
  platforms?: string[];
  statuses?: string[];
  categories?: string[];
  reviewTypes?: string[];
  search?: string;
  sortBy?: string;
  paybackOnly?: boolean;
  completedOnly?: boolean;
}

interface SchedulePagination {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface ScheduleCounts {
  total: number;
  visit: number;
  deadline: number;
  overall?: number;
}

interface UseSchedulesReturn {
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  pagination: SchedulePagination | null;
  counts: ScheduleCounts | null;
  platforms: string[];
  createSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<Schedule | null>;
  updateSchedule: (id: number, updates: Partial<Schedule>) => Promise<boolean>;
  deleteSchedule: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// DB -> Frontend 매핑
export function mapDbToSchedule(db: DbSchedule): Schedule {
  let additionalDeadlines: AdditionalDeadline[] = [];
  if (db.additional_deadlines) {
    try {
      const parsed =
        typeof db.additional_deadlines === 'string'
          ? JSON.parse(db.additional_deadlines)
          : db.additional_deadlines;
      if (Array.isArray(parsed)) {
        additionalDeadlines = parsed;
      }
    } catch (e) {
      console.error('Failed to parse additional_deadlines:', e);
    }
  }

  return {
    id: db.id,
    title: db.title,
    status: db.status as Schedule['status'],
    platform: db.platform || '',
    reviewType: (db.review_type || '제공형') as Schedule['reviewType'],
    channel: parseStoredChannels(db.channel),
    category: (db.category || '기타') as Schedule['category'],
    region: db.region || '',
    regionDetail: db.region_detail || '',
    lat: db.lat ?? undefined,
    lng: db.lng ?? undefined,
    visit: db.visit_date || '',
    visitTime: db.visit_time || '',
    dead: db.deadline || '',
    additionalDeadlines,
    benefit: toNumber(db.benefit),
    income: toNumber(db.income),
    cost: toNumber(db.cost),
    postingLink: db.posting_link || '',
    purchaseLink: db.purchase_link || '',
    guideFiles: db.guide_files || [],
    memo: db.memo || '',
    visitReviewChecklist: db.visit_review_checklist || undefined,
    paybackExpected: db.payback_expected,
    paybackConfirmed: db.payback_confirmed,
    phone: db.phone || '',
    ownerPhone: db.owner_phone || '',
    incomeDetailsJson: db.income_details_json || undefined,
  };
}

// Frontend -> DB 매핑 (Insert)
function mapScheduleToDb(schedule: Omit<Schedule, 'id'>, userId: string) {
  return {
    user_id: userId,
    title: schedule.title,
    status: schedule.status,
    platform: schedule.platform || null,
    review_type: schedule.reviewType,
    channel: stringifyChannels(schedule.channel),
    category: schedule.category,
    region: schedule.region || null,
    region_detail: schedule.regionDetail || null,
    visit_date: schedule.visit || null,
    visit_time: schedule.visitTime || null,
    deadline: schedule.dead || null,
    additional_deadlines: schedule.additionalDeadlines?.length
      ? JSON.stringify(schedule.additionalDeadlines)
      : null,
    benefit: schedule.benefit || 0,
    income: schedule.income || 0,
    cost: schedule.cost || 0,
    income_details_json: schedule.incomeDetailsJson || null,
    posting_link: schedule.postingLink || '',
    purchase_link: schedule.purchaseLink || '',
    guide_files: schedule.guideFiles || [],
    memo: schedule.memo || '',
    visit_review_checklist: schedule.visitReviewChecklist || null,
    payback_expected: schedule.paybackExpected || false,
    payback_confirmed: schedule.paybackConfirmed || false,
    phone: schedule.phone || null,
    owner_phone: schedule.ownerPhone || null,
    lat: schedule.lat ?? null,
    lng: schedule.lng ?? null,
  };
}

// Frontend -> DB 매핑 (Update)
function mapScheduleUpdatesToDb(updates: Partial<Schedule>) {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.platform !== undefined) dbUpdates.platform = updates.platform;
  if (updates.reviewType !== undefined) dbUpdates.review_type = updates.reviewType;
  if (updates.channel !== undefined) dbUpdates.channel = stringifyChannels(updates.channel);
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.region !== undefined) dbUpdates.region = updates.region;
  if (updates.visit !== undefined) dbUpdates.visit_date = updates.visit || null;
  if (updates.visitTime !== undefined) dbUpdates.visit_time = updates.visitTime || null;
  if (updates.dead !== undefined) dbUpdates.deadline = updates.dead;
  if (updates.additionalDeadlines !== undefined) {
    dbUpdates.additional_deadlines = updates.additionalDeadlines?.length
      ? JSON.stringify(updates.additionalDeadlines)
      : null;
  }
  if (updates.benefit !== undefined) dbUpdates.benefit = updates.benefit;
  if (updates.income !== undefined) dbUpdates.income = updates.income;
  if (updates.cost !== undefined) dbUpdates.cost = updates.cost;
  if (updates.incomeDetailsJson !== undefined)
    dbUpdates.income_details_json = updates.incomeDetailsJson;
  if (updates.postingLink !== undefined) dbUpdates.posting_link = updates.postingLink;
  if (updates.purchaseLink !== undefined) dbUpdates.purchase_link = updates.purchaseLink;
  if (updates.guideFiles !== undefined) dbUpdates.guide_files = updates.guideFiles;
  if (updates.memo !== undefined) dbUpdates.memo = updates.memo;
  if (updates.visitReviewChecklist !== undefined)
    dbUpdates.visit_review_checklist = updates.visitReviewChecklist;
  if (updates.paybackExpected !== undefined) dbUpdates.payback_expected = updates.paybackExpected;
  if (updates.paybackConfirmed !== undefined)
    dbUpdates.payback_confirmed = updates.paybackConfirmed;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.ownerPhone !== undefined) dbUpdates.owner_phone = updates.ownerPhone;

  if (updates.regionDetail !== undefined) dbUpdates.region_detail = updates.regionDetail;
  if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
  if (updates.lng !== undefined) dbUpdates.lng = updates.lng;

  return dbUpdates;
}

export function useSchedules(options: UseSchedulesOptions = {}): UseSchedulesReturn {
  const {
    enabled = true,
    offset: initialOffset = 0,
    limit = 20,
    selectedDate,
    month,
    platforms = [],
    statuses = [],
    categories = [],
    reviewTypes = [],
    search = '',
    sortBy = 'deadline-asc',
    paybackOnly = false,
    completedOnly = false,
  } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<SchedulePagination | null>(null);
  const [counts, setCounts] = useState<ScheduleCounts | null>(null);
  const [responsePlatforms, setResponsePlatforms] = useState<string[]>([]);
  const [currentOffset, setCurrentOffset] = useState(initialOffset);
  const cacheRef = React.useRef(
    new Map<
      string,
      {
        schedules: Schedule[];
        pagination: SchedulePagination | null;
        counts: ScheduleCounts | null;
        platforms: string[];
        currentOffset: number;
      }
    >()
  );

  const showError = useCallback(
    (message: string) => {
      setError(message);
      toast({
        title: '오류가 발생했습니다',
        description: message,
        variant: 'destructive',
        duration: 1000,
      });
    },
    [toast]
  );

  const userId = user?.id;

  const platformsKey = platforms.join(',');
  const statusesKey = statuses.join(',');
  const categoriesKey = categories.join(',');
  const reviewTypesKey = reviewTypes.join(',');

  const cacheKey = React.useMemo(
    () =>
      JSON.stringify({
        userId,
        selectedDate,
        month,
        platforms: platformsKey,
        statuses: statusesKey,
        categories: categoriesKey,
        reviewTypes: reviewTypesKey,
        search,
        sortBy,
        paybackOnly,
        completedOnly,
        limit,
      }),
    [
      userId,
      selectedDate,
      month,
      platformsKey,
      statusesKey,
      categoriesKey,
      reviewTypesKey,
      search,
      sortBy,
      paybackOnly,
      completedOnly,
      limit,
    ]
  );

  const updateCacheSchedules = useCallback(
    (updater: (prev: Schedule[]) => Schedule[]) => {
      const cached = cacheRef.current.get(cacheKey);
      if (!cached) return;
      const nextSchedules = updater(cached.schedules);
      cacheRef.current.set(cacheKey, { ...cached, schedules: nextSchedules });
    },
    [cacheKey]
  );

  const fetchSchedules = useCallback(
    async (force = false, append = false) => {
      if (!userId) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const cached = cacheRef.current.get(cacheKey);

      if (!force && !append && cached) {
        setSchedules(cached.schedules);
        setPagination(cached.pagination);
        setCounts(cached.counts);
        setResponsePlatforms(cached.platforms);
        setCurrentOffset(cached.currentOffset);
        setLoading(false);
        return;
      }

      if (!append) {
        setLoading(true);
      }
      setError(null);

      try {
        // Build query params
        const params = new URLSearchParams({
          offset: append ? currentOffset.toString() : '0',
          limit: limit.toString(),
          userId,
        });

        const isSearchRequest = Boolean(search);

        if (isSearchRequest) {
          params.append('search', search);
        } else {
          if (selectedDate) params.append('selectedDate', selectedDate);
          if (month) params.append('month', month);
          if (platformsKey) params.append('platforms', platformsKey);
          if (statusesKey) params.append('statuses', statusesKey);
          if (categoriesKey) params.append('categories', categoriesKey);
          if (reviewTypesKey) params.append('reviewTypes', reviewTypesKey);
          if (paybackOnly) params.append('paybackOnly', 'true');
          // deadline-asc is default, so skip putting it in url to keep it clean
          if (sortBy && sortBy !== 'deadline-asc') params.append('sortBy', sortBy);
        }
        if (force) params.append('refresh', '1');

        const endpoint = isSearchRequest
          ? '/api/schedules/search'
          : completedOnly
            ? '/api/schedules/completed'
            : '/api/schedules';
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch schedules');
        }

        const data = await response.json();

        if (data.error) {
          showError(data.error);
          setSchedules([]);
        } else {
          const newSchedules = (data.schedules || []).map(mapDbToSchedule);

          const nextPagination = data.pagination;
          const nextCounts = data.counts;
          const nextPlatforms = data.platforms || responsePlatforms;
          const nextOffset = append ? currentOffset + limit : limit;

          if (append) {
            setSchedules((prev) => {
              const existingIds = new Set(prev.map((s) => s.id));
              const uniqueNewSchedules = newSchedules.filter((s) => !existingIds.has(s.id));
              const merged = [...prev, ...uniqueNewSchedules];
              cacheRef.current.set(cacheKey, {
                schedules: merged,
                pagination: nextPagination,
                counts: nextCounts,
                platforms: nextPlatforms,
                currentOffset: nextOffset,
              });
              return merged;
            });
          } else {
            setSchedules(newSchedules);
            cacheRef.current.set(cacheKey, {
              schedules: newSchedules,
              pagination: nextPagination,
              counts: nextCounts,
              platforms: nextPlatforms,
              currentOffset: nextOffset,
            });
          }

          setPagination(nextPagination);
          setCounts(nextCounts);
          if (data.platforms) setResponsePlatforms(data.platforms);
          setCurrentOffset(nextOffset);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    },
    [
      userId,
      currentOffset,
      limit,
      selectedDate,
      month,
      platformsKey,
      statusesKey,
      categoriesKey,
      reviewTypesKey,
      paybackOnly,
      completedOnly,
      search,
      sortBy,
      showError,
      responsePlatforms,
      cacheKey,
    ]
  );

  const loadMore = useCallback(async () => {
    if (pagination?.hasMore) {
      await fetchSchedules(false, true);
    }
  }, [pagination, fetchSchedules]);

  const refreshAfterMutation = useCallback(() => {
    cacheRef.current.delete(cacheKey);
    if (enabled) {
      fetchSchedules(true);
    }
  }, [cacheKey, enabled, fetchSchedules]);

  useEffect(() => {
    if (enabled) {
      // 필터가 변경되면 offset 초기화하고 새로 fetch
      setCurrentOffset(0);
      fetchSchedules();
    } else {
      setLoading(false);
    }
  }, [
    enabled,
    userId,
    selectedDate,
    month,
    platformsKey,
    statusesKey,
    categoriesKey,
    paybackOnly,
    completedOnly,
    reviewTypesKey,
    search,
    sortBy,
  ]);

  const createSchedule = useCallback(
    async (schedule: Omit<Schedule, 'id'>): Promise<Schedule | null> => {
      if (!user) return null;

      try {
        const supabase = getSupabaseClient();
        const { data, error: insertError } = await supabase
          .from('schedules')
          .insert([mapScheduleToDb(schedule, user.id)])
          .select()
          .single();

        if (insertError) {
          showError(insertError.message);
          return null;
        }

        const newSchedule = mapDbToSchedule(data);
        setSchedules((prev) => [newSchedule, ...prev]);
        updateCacheSchedules((prev) => [newSchedule, ...prev]);
        refreshAfterMutation();
        return newSchedule;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return null;
      }
    },
    [user, showError, refreshAfterMutation, updateCacheSchedules]
  );

  const updateSchedule = useCallback(
    async (id: number, updates: Partial<Schedule>): Promise<boolean> => {
      if (!user) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('schedules')
          .update(mapScheduleUpdatesToDb(updates))
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
        updateCacheSchedules((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
        );
        refreshAfterMutation();
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError, refreshAfterMutation, updateCacheSchedules]
  );

  const deleteSchedule = useCallback(
    async (id: number): Promise<boolean> => {
      if (!user) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: deleteError } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) {
          showError(deleteError.message);
          return false;
        }

        setSchedules((prev) => prev.filter((s) => s.id !== id));
        updateCacheSchedules((prev) => prev.filter((s) => s.id !== id));
        refreshAfterMutation();
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError, refreshAfterMutation, updateCacheSchedules]
  );

  return {
    schedules,
    loading,
    error,
    pagination,
    counts,
    platforms: responsePlatforms,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refetch: () => fetchSchedules(true),
    loadMore,
  };
}
