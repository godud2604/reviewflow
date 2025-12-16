"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from './use-auth'
import { useToast } from './use-toast'
import type { Schedule } from '@/types'
import type { DbSchedule } from '@/types/database'
import { parseStoredChannels, stringifyChannels } from '@/lib/schedule-channels'

interface UseSchedulesOptions {
  enabled?: boolean
}

interface UseSchedulesReturn {
  schedules: Schedule[]
  loading: boolean
  error: string | null
  createSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<Schedule | null>
  updateSchedule: (id: number, updates: Partial<Schedule>) => Promise<boolean>
  deleteSchedule: (id: number) => Promise<boolean>
  refetch: () => Promise<void>
}

const toNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

// DB -> Frontend 매핑
function mapDbToSchedule(db: DbSchedule): Schedule {
  return {
    id: db.id,
    title: db.title,
    status: db.status as Schedule['status'],
    platform: db.platform || '',
    reviewType: (db.review_type || '제공형') as Schedule['reviewType'],
    channel: parseStoredChannels(db.channel),
    category: (db.category || '기타') as Schedule['category'],
    region: db.region || '',
    visit: db.visit_date || '',
    visitTime: db.visit_time || '',
    dead: db.deadline || '',
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
    paybackConfirmed: db.payback_confirmed,
  }
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
    visit_date: schedule.visit || null,
    visit_time: schedule.visitTime || null,
    deadline: schedule.dead || null,
    benefit: schedule.benefit || 0,
    income: schedule.income || 0,
    cost: schedule.cost || 0,
    posting_link: schedule.postingLink || '',
    purchase_link: schedule.purchaseLink || '',
    guide_files: schedule.guideFiles || [],
    memo: schedule.memo || '',
    reconfirm_reason: schedule.reconfirmReason || null,
    visit_review_checklist: schedule.visitReviewChecklist || null,
    payback_expected: schedule.paybackExpected || false,
    payback_confirmed: schedule.paybackConfirmed || false,
  }
}

// Frontend -> DB 매핑 (Update)
function mapScheduleUpdatesToDb(updates: Partial<Schedule>) {
  const dbUpdates: Record<string, unknown> = {}
  
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.platform !== undefined) dbUpdates.platform = updates.platform
  if (updates.reviewType !== undefined) dbUpdates.review_type = updates.reviewType
  if (updates.channel !== undefined) dbUpdates.channel = stringifyChannels(updates.channel)
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.region !== undefined) dbUpdates.region = updates.region
  if (updates.visit !== undefined) dbUpdates.visit_date = updates.visit
  if (updates.visitTime !== undefined) dbUpdates.visit_time = updates.visitTime
  if (updates.dead !== undefined) dbUpdates.deadline = updates.dead
  if (updates.benefit !== undefined) dbUpdates.benefit = updates.benefit
  if (updates.income !== undefined) dbUpdates.income = updates.income
  if (updates.cost !== undefined) dbUpdates.cost = updates.cost
  if (updates.postingLink !== undefined) dbUpdates.posting_link = updates.postingLink
  if (updates.purchaseLink !== undefined) dbUpdates.purchase_link = updates.purchaseLink
  if (updates.guideFiles !== undefined) dbUpdates.guide_files = updates.guideFiles
  if (updates.memo !== undefined) dbUpdates.memo = updates.memo
  if (updates.reconfirmReason !== undefined) dbUpdates.reconfirm_reason = updates.reconfirmReason
  if (updates.visitReviewChecklist !== undefined) dbUpdates.visit_review_checklist = updates.visitReviewChecklist
  if (updates.paybackExpected !== undefined) dbUpdates.payback_expected = updates.paybackExpected
  if (updates.paybackConfirmed !== undefined) dbUpdates.payback_confirmed = updates.paybackConfirmed
  
  return dbUpdates
}

export function useSchedules(options: UseSchedulesOptions = {}): UseSchedulesReturn {
  const { enabled = true } = options
  const { user } = useAuth()
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetchedRef = React.useRef(false)

  const showError = useCallback((message: string) => {
    setError(message)
    toast({
      title: '오류가 발생했습니다',
      description: message,
      variant: 'destructive',
      duration: 3000,
    })
  }, [toast])

  const userId = user?.id

  const fetchSchedules = useCallback(async (force = false) => {
    if (!userId) {
      setSchedules([])
      setLoading(false)
      return
    }

    // Skip if already fetched and not forcing
    if (hasFetchedRef.current && !force) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        showError(fetchError.message)
        setSchedules([])
      } else {
        setSchedules((data || []).map(mapDbToSchedule))
        hasFetchedRef.current = true
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [userId, showError])

  useEffect(() => {
    if (enabled) {
      fetchSchedules()
    } else {
      setLoading(false)
    }
  }, [enabled, fetchSchedules])

  const createSchedule = useCallback(async (schedule: Omit<Schedule, 'id'>): Promise<Schedule | null> => {
    if (!user) return null

    try {
      const supabase = getSupabaseClient()
      const { data, error: insertError } = await supabase
        .from('schedules')
        .insert([mapScheduleToDb(schedule, user.id)])
        .select()
        .single()

      if (insertError) {
        showError(insertError.message)
        return null
      }

      const newSchedule = mapDbToSchedule(data)
      setSchedules(prev => [newSchedule, ...prev])
      return newSchedule
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return null
    }
  }, [user, showError])

  const updateSchedule = useCallback(async (id: number, updates: Partial<Schedule>): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('schedules')
        .update(mapScheduleUpdatesToDb(updates))
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  const deleteSchedule = useCallback(async (id: number): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        showError(deleteError.message)
        return false
      }

      setSchedules(prev => prev.filter(s => s.id !== id))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  return {
    schedules,
    loading,
    error,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refetch: () => fetchSchedules(true),
  }
}
