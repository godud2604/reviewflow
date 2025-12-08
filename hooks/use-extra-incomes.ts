"use client"

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from './use-auth'
import { useToast } from './use-toast'
import type { ExtraIncome } from '@/types'
import type { DbExtraIncome } from '@/types/database'

interface UseExtraIncomesReturn {
  extraIncomes: ExtraIncome[]
  loading: boolean
  error: string | null
  createExtraIncome: (income: Omit<ExtraIncome, 'id'>) => Promise<ExtraIncome | null>
  updateExtraIncome: (id: number, updates: Partial<ExtraIncome>) => Promise<boolean>
  deleteExtraIncome: (id: number) => Promise<boolean>
  refetch: () => Promise<void>
}

// DB -> Frontend 매핑
function mapDbToExtraIncome(db: DbExtraIncome): ExtraIncome {
  return {
    id: db.id,
    title: db.title,
    amount: db.amount || 0,
    date: db.date || '',
    memo: db.memo || undefined,
  }
}

// Frontend -> DB 매핑 (Insert)
function mapExtraIncomeToDb(income: Omit<ExtraIncome, 'id'>, userId: string) {
  return {
    user_id: userId,
    title: income.title,
    amount: income.amount || 0,
    date: income.date || null,
    memo: income.memo || null,
  }
}

// Frontend -> DB 매핑 (Update)
function mapExtraIncomeUpdatesToDb(updates: Partial<ExtraIncome>) {
  const dbUpdates: Record<string, unknown> = {}
  
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.memo !== undefined) dbUpdates.memo = updates.memo
  
  return dbUpdates
}

export function useExtraIncomes(): UseExtraIncomesReturn {
  const { user } = useAuth()
  const { toast } = useToast()
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const showError = useCallback((message: string) => {
    setError(message)
    toast({
      title: '오류가 발생했습니다',
      description: message,
      variant: 'destructive',
      duration: 3000,
    })
  }, [toast])

  const fetchExtraIncomes = useCallback(async () => {
    if (!user) {
      setExtraIncomes([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('extra_incomes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (fetchError) {
        showError(fetchError.message)
        setExtraIncomes([])
      } else {
        setExtraIncomes((data || []).map(mapDbToExtraIncome))
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [user, showError])

  useEffect(() => {
    fetchExtraIncomes()
  }, [fetchExtraIncomes])

  const createExtraIncome = useCallback(async (income: Omit<ExtraIncome, 'id'>): Promise<ExtraIncome | null> => {
    if (!user) return null

    try {
      const supabase = getSupabaseClient()
      const { data, error: insertError } = await supabase
        .from('extra_incomes')
        .insert([mapExtraIncomeToDb(income, user.id)])
        .select()
        .single()

      if (insertError) {
        showError(insertError.message)
        return null
      }

      const newIncome = mapDbToExtraIncome(data)
      setExtraIncomes(prev => [newIncome, ...prev])
      return newIncome
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return null
    }
  }, [user, showError])

  const updateExtraIncome = useCallback(async (id: number, updates: Partial<ExtraIncome>): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('extra_incomes')
        .update(mapExtraIncomeUpdatesToDb(updates))
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setExtraIncomes(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  const deleteExtraIncome = useCallback(async (id: number): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: deleteError } = await supabase
        .from('extra_incomes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        showError(deleteError.message)
        return false
      }

      setExtraIncomes(prev => prev.filter(e => e.id !== id))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  return {
    extraIncomes,
    loading,
    error,
    createExtraIncome,
    updateExtraIncome,
    deleteExtraIncome,
    refetch: fetchExtraIncomes,
  }
}
