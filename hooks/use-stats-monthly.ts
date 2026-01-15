'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { ExtraIncome, MonthlyGrowth, Schedule } from '@/types';
import type { DbExtraIncome, DbSchedule } from '@/types/database';
import { mapDbToSchedule } from '@/hooks/use-schedules';

interface UseStatsMonthlyOptions {
  enabled?: boolean;
  month?: string;
}

interface UseStatsMonthlyReturn {
  schedules: Schedule[];
  extraIncomes: ExtraIncome[];
  monthlyGrowth: MonthlyGrowth[];
  availableMonths: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

type StatsMonthlyResponse = {
  monthStart: string;
  schedules: DbSchedule[];
  extraIncomes: DbExtraIncome[];
  monthlyGrowth: MonthlyGrowth[];
  availableMonths: string[];
};

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const mapDbToExtraIncome = (db: DbExtraIncome): ExtraIncome => ({
  id: db.id,
  title: db.title,
  amount: toNumber(db.amount),
  date: db.date || '',
  memo: db.memo || undefined,
});

export function useStatsMonthly(options: UseStatsMonthlyOptions = {}): UseStatsMonthlyReturn {
  const { enabled = true, month } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([]);
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowth[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = React.useRef(
    new Map<
      string,
      {
        schedules: Schedule[];
        extraIncomes: ExtraIncome[];
        monthlyGrowth: MonthlyGrowth[];
        availableMonths: string[];
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

  const fetchStats = useCallback(
    async (force = false) => {
    if (!userId) {
      setSchedules([]);
      setExtraIncomes([]);
      setMonthlyGrowth([]);
      setAvailableMonths([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${userId}:${month || 'current'}`;
    const cached = cacheRef.current.get(cacheKey);

    if (cached && !force) {
      setSchedules(cached.schedules);
      setExtraIncomes(cached.extraIncomes);
      setMonthlyGrowth(cached.monthlyGrowth);
      setAvailableMonths(cached.availableMonths);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ userId });
      if (month) params.append('month', month);
      if (force) params.append('refresh', '1');

      const response = await fetch(`/api/stats/monthly?${params.toString()}`, {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch monthly stats');
      }

      const data = (await response.json()) as StatsMonthlyResponse & { error?: string };

      if (data.error) {
        showError(data.error);
        setSchedules([]);
        setExtraIncomes([]);
        setMonthlyGrowth([]);
        setAvailableMonths([]);
        return;
      }

      const nextSchedules = (data.schedules || []).map(mapDbToSchedule);
      const nextExtraIncomes = (data.extraIncomes || []).map(mapDbToExtraIncome);
      const nextMonthlyGrowth = data.monthlyGrowth || [];
      const nextAvailableMonths = data.availableMonths || [];

      setSchedules(nextSchedules);
      setExtraIncomes(nextExtraIncomes);
      setMonthlyGrowth(nextMonthlyGrowth);
      setAvailableMonths(nextAvailableMonths);
      cacheRef.current.set(cacheKey, {
        schedules: nextSchedules,
        extraIncomes: nextExtraIncomes,
        monthlyGrowth: nextMonthlyGrowth,
        availableMonths: nextAvailableMonths,
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  },
    [userId, month, showError]
  );

  useEffect(() => {
    if (enabled) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchStats]);

  return {
    schedules,
    extraIncomes,
    monthlyGrowth,
    availableMonths,
    loading,
    error,
    refetch: useCallback(() => fetchStats(true), [fetchStats]),
  };
}
