'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { MonthlyGrowth } from '@/types';
import type { DbMonthlyGrowth } from '@/types/database';

interface UseMonthlyGrowthOptions {
  enabled?: boolean;
}

interface UseMonthlyGrowthReturn {
  monthlyGrowth: MonthlyGrowth[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// DB -> Frontend 매핑
function mapDbToMonthlyGrowth(db: DbMonthlyGrowth): MonthlyGrowth {
  return {
    monthStart: db.month_start,
    benefitTotal: toNumber(db.benefit_total),
    incomeTotal: toNumber(db.income_total),
    costTotal: toNumber(db.cost_total),
    extraIncomeTotal: toNumber(db.extra_income_total),
    econValue: toNumber(db.econ_value),
  };
}

export function useMonthlyGrowth(options: UseMonthlyGrowthOptions = {}): UseMonthlyGrowthReturn {
  const { enabled = true } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [monthlyGrowth, setMonthlyGrowth] = useState<MonthlyGrowth[]>([]);
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

  const fetchMonthlyGrowth = useCallback(
    async (force = false) => {
      if (!userId) {
        setMonthlyGrowth([]);
        setLoading(false);
        return;
      }

      if (hasFetchedRef.current && !force) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from('monthly_growth')
          .select('*')
          .eq('user_id', userId)
          .order('month_start', { ascending: true });

        if (fetchError) {
          showError(fetchError.message);
          setMonthlyGrowth([]);
        } else {
          setMonthlyGrowth((data || []).map(mapDbToMonthlyGrowth));
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
      fetchMonthlyGrowth();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchMonthlyGrowth]);

  return {
    monthlyGrowth,
    loading,
    error,
    refetch: useCallback(() => fetchMonthlyGrowth(true), [fetchMonthlyGrowth]),
  };
}
