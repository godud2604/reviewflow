'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { Schedule, AdditionalDeadline } from '@/types';
import type { DbSchedule } from '@/types/database';
import { parseStoredChannels, stringifyChannels } from '@/lib/schedule-channels';

const LEGACY_PAYBACK_DEADLINE_ID = '__payback_expected_date__';

interface UseSchedulesOptions {
  enabled?: boolean;
}

interface UseSchedulesReturn {
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  createSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<Schedule | null>;
  updateSchedule: (id: number, updates: Partial<Schedule>) => Promise<boolean>;
  deleteSchedule: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// DB -> Frontend 매핑
function mapDbToSchedule(db: DbSchedule): Schedule {
  let additionalDeadlines: AdditionalDeadline[] = [];
  let legacyPaybackDate = '';
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

  if (additionalDeadlines.length > 0) {
    const legacy = additionalDeadlines.find((d) => d?.id === LEGACY_PAYBACK_DEADLINE_ID);
    legacyPaybackDate = legacy?.date || '';
    additionalDeadlines = additionalDeadlines.filter((d) => d?.id !== LEGACY_PAYBACK_DEADLINE_ID);
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
    reconfirmReason: db.reconfirm_reason || undefined,
    visitReviewChecklist: db.visit_review_checklist || undefined,
    paybackExpected: db.payback_expected,
    paybackExpectedDate:
      db.payback_expected_date || legacyPaybackDate || (db.payback_expected ? db.deadline || '' : ''),
    paybackExpectedAmount: db.payback_expected_amount ?? 0,
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
    reconfirm_reason: schedule.reconfirmReason || null,
    visit_review_checklist: schedule.visitReviewChecklist || null,
    payback_expected: schedule.paybackExpected || false,
    payback_expected_date:
      schedule.paybackExpected && schedule.paybackExpectedDate
        ? schedule.paybackExpectedDate
        : null,
    payback_expected_amount:
      schedule.paybackExpected && schedule.paybackExpectedAmount && schedule.paybackExpectedAmount > 0
        ? schedule.paybackExpectedAmount
        : null,
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
  if (updates.visit !== undefined) dbUpdates.visit_date = updates.visit;
  if (updates.visitTime !== undefined) dbUpdates.visit_time = updates.visitTime;
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
  if (updates.reconfirmReason !== undefined) dbUpdates.reconfirm_reason = updates.reconfirmReason;
  if (updates.visitReviewChecklist !== undefined)
    dbUpdates.visit_review_checklist = updates.visitReviewChecklist;
  if (updates.paybackExpected !== undefined) dbUpdates.payback_expected = updates.paybackExpected;
  if (updates.paybackExpectedDate !== undefined) {
    dbUpdates.payback_expected_date = updates.paybackExpectedDate || null;
  }
  if (updates.paybackExpectedAmount !== undefined) {
    dbUpdates.payback_expected_amount =
      updates.paybackExpectedAmount && updates.paybackExpectedAmount > 0
        ? updates.paybackExpectedAmount
        : null;
  }
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
  const { enabled = true } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

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

  const fetchSchedules = useCallback(
    async (force = false) => {
      if (!userId) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // Skip if already fetched and not forcing
      if (hasFetchedRef.current && !force) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from('schedules')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          showError(fetchError.message);
          setSchedules([]);
        } else {
          setSchedules((data || []).map(mapDbToSchedule));
          hasFetchedRef.current = true;
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    },
    [userId, showError]
  );

  useEffect(() => {
    if (enabled) {
      fetchSchedules();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchSchedules]);

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
        return newSchedule;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return null;
      }
    },
    [user, showError]
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
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError]
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
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError]
  );

  return {
    schedules,
    loading,
    error,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refetch: () => fetchSchedules(true),
  };
}
