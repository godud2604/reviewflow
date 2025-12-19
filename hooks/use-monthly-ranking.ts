"use client"

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './use-auth'
import { useToast } from './use-toast'
import type { MonthlyRankingResponse } from '@/types'

interface UseMonthlyRankingReturn {
  monthlyRanking: MonthlyRankingResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function buildMonthParam() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function useMonthlyRanking(): UseMonthlyRankingReturn {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [monthlyRanking, setMonthlyRanking] = useState<MonthlyRankingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showError = useCallback(
    (message: string) => {
      setError(message)
      toast({
        title: '순위 정보를 불러오는 중 오류 발생',
        description: message,
        variant: 'destructive',
        duration: 3000,
      })
    },
    [toast],
  )

  const fetchRanking = useCallback(async () => {
    if (!user?.id) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const monthParam = buildMonthParam()
      const response = await fetch(
        `/api/monthly-ranking?userId=${encodeURIComponent(user.id)}&month=${monthParam}`,
        {
          cache: 'no-store',
        },
      )
      const payload = await response.json()

      if (!response.ok) {
        const errorText =
          payload && typeof payload === 'object' && 'error' in payload
            ? payload.error
            : null
        const message =
          typeof errorText === 'string' && errorText.length > 0
            ? errorText
            : '순위 정보를 불러오는 중 오류가 발생했습니다.'
        throw new Error(message)
      }

      setMonthlyRanking(payload as MonthlyRankingResponse)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '서버와 통신할 수 없습니다. 다시 시도해주세요.'
      showError(message)
      setMonthlyRanking(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id, showError])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user?.id) {
      setMonthlyRanking(null)
      setLoading(false)
      return
    }

    void fetchRanking()
  }, [authLoading, user?.id, fetchRanking])

  return {
    monthlyRanking,
    loading,
    error,
    refetch: fetchRanking,
  }
}
