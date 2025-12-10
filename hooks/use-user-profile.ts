"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from './use-auth'
import { useToast } from './use-toast'

const DEFAULT_PLATFORMS = ['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스']
const DEFAULT_CATEGORIES = [
  '맛집/식품',
  '뷰티',
  '출산/육아',
  '반려동물',
  '생활/리빙',
  '주방/가전',
] as const

interface UserProfile {
  id: string
  nickname: string | null
  platforms: string[]
  categories: string[]
}

interface UseUserProfileOptions {
  enabled?: boolean
}

interface UseUserProfileReturn {
  profile: UserProfile | null
  platforms: string[]
  categories: string[]
  loading: boolean
  error: string | null
  addPlatform: (platform: string) => Promise<boolean>
  removePlatform: (platform: string) => Promise<boolean>
  updateNickname: (nickname: string) => Promise<boolean>
  updateCategories: (categories: string[]) => Promise<boolean>
  refetch: () => Promise<void>
}

export function useUserProfile(options: UseUserProfileOptions = {}): UseUserProfileReturn {
  const { enabled = true } = options
  const { user } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFetchedRef = React.useRef(false)

  const userId = user?.id

  const showError = useCallback((message: string) => {
    setError(message)
    toast({
      title: '오류가 발생했습니다',
      description: message,
      variant: 'destructive',
      duration: 3000,
    })
  }, [toast])

  const fetchProfile = useCallback(async (force = false) => {
    if (!userId) {
      setProfile(null)
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
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError) {
        // 프로필이 없으면 생성 (기본 플랫폼 포함)
        if (fetchError.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('user_profiles')
            .insert([{ id: userId, platforms: DEFAULT_PLATFORMS, categories: DEFAULT_CATEGORIES }])
            .select()
            .single()
          
          if (insertError) {
            showError(insertError.message)
            setProfile(null)
          } else {
            setProfile({
              id: newProfile.id,
              nickname: newProfile.nickname,
              platforms: newProfile.platforms || DEFAULT_PLATFORMS,
              categories: newProfile.categories || [...DEFAULT_CATEGORIES],
            })
            hasFetchedRef.current = true
          }
        } else {
          showError(fetchError.message)
          setProfile(null)
        }
      } else {
        setProfile({
          id: data.id,
          nickname: data.nickname,
          platforms: data.platforms || DEFAULT_PLATFORMS,
          categories: data.categories && data.categories.length > 0 ? data.categories : [...DEFAULT_CATEGORIES],
        })
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
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [enabled, fetchProfile])

  const addPlatform = useCallback(async (platform: string): Promise<boolean> => {
    if (!userId || !profile) return false

    const trimmedPlatform = platform.trim()
    if (!trimmedPlatform) return false

    // 중복 체크
    if (profile.platforms.includes(trimmedPlatform)) {
      toast({
        title: '이미 등록된 플랫폼입니다.',
        variant: 'destructive',
        duration: 2000,
      })
      return false
    }

    const newPlatforms = [...profile.platforms, trimmedPlatform]

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ platforms: newPlatforms })
        .eq('id', userId)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setProfile({ ...profile, platforms: newPlatforms })
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [userId, profile, showError, toast])

  const removePlatform = useCallback(async (platform: string): Promise<boolean> => {
    if (!userId || !profile) return false

    const newPlatforms = profile.platforms.filter(p => p !== platform)

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ platforms: newPlatforms })
        .eq('id', userId)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setProfile({ ...profile, platforms: newPlatforms })
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [userId, profile, showError])

  const updateNickname = useCallback(async (nickname: string): Promise<boolean> => {
    if (!userId || !profile) return false

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ nickname })
        .eq('id', userId)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setProfile({ ...profile, nickname })
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [userId, profile, showError])

  const updateCategories = useCallback(async (categories: string[]): Promise<boolean> => {
    if (!userId || !profile) return false

    const cleaned = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)))

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ categories: cleaned })
        .eq('id', userId)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setProfile({ ...profile, categories: cleaned })
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [userId, profile, showError])

  return {
    profile,
    platforms: profile?.platforms || [],
    categories: profile?.categories || [],
    loading,
    error,
    addPlatform,
    removePlatform,
    updateNickname,
    updateCategories,
    refetch: () => fetchProfile(true),
  }
}
