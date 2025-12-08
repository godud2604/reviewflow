"use client"

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from './use-auth'
import { useToast } from './use-toast'
import type { Channel } from '@/types'
import type { DbChannel } from '@/types/database'

interface UseChannelsReturn {
  channels: Channel[]
  loading: boolean
  error: string | null
  createChannel: (channel: Omit<Channel, 'id'>) => Promise<Channel | null>
  updateChannel: (id: number, updates: Partial<Channel>) => Promise<boolean>
  deleteChannel: (id: number) => Promise<boolean>
  refetch: () => Promise<void>
}

// DB -> Frontend 매핑
function mapDbToChannel(db: DbChannel): Channel {
  return {
    id: db.id,
    type: db.type as Channel['type'],
    name: db.name,
    followers: db.followers || undefined,
    monthlyVisitors: db.monthly_visitors || undefined,
    avgViews: db.avg_views || undefined,
    avgReach: db.avg_reach || undefined,
    avgEngagement: db.avg_engagement || undefined,
    url: db.url || undefined,
  }
}

// Frontend -> DB 매핑 (Insert)
function mapChannelToDb(channel: Omit<Channel, 'id'>, userId: string) {
  return {
    user_id: userId,
    type: channel.type,
    name: channel.name,
    followers: channel.followers || null,
    monthly_visitors: channel.monthlyVisitors || null,
    avg_views: channel.avgViews || null,
    avg_reach: channel.avgReach || null,
    avg_engagement: channel.avgEngagement || null,
    url: channel.url || null,
  }
}

// Frontend -> DB 매핑 (Update)
function mapChannelUpdatesToDb(updates: Partial<Channel>) {
  const dbUpdates: Record<string, unknown> = {}
  
  if (updates.type !== undefined) dbUpdates.type = updates.type
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.followers !== undefined) dbUpdates.followers = updates.followers
  if (updates.monthlyVisitors !== undefined) dbUpdates.monthly_visitors = updates.monthlyVisitors
  if (updates.avgViews !== undefined) dbUpdates.avg_views = updates.avgViews
  if (updates.avgReach !== undefined) dbUpdates.avg_reach = updates.avgReach
  if (updates.avgEngagement !== undefined) dbUpdates.avg_engagement = updates.avgEngagement
  if (updates.url !== undefined) dbUpdates.url = updates.url
  
  return dbUpdates
}

export function useChannels(): UseChannelsReturn {
  const { user } = useAuth()
  const { toast } = useToast()
  const [channels, setChannels] = useState<Channel[]>([])
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

  const fetchChannels = useCallback(async () => {
    if (!user) {
      setChannels([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        showError(fetchError.message)
        setChannels([])
      } else {
        setChannels((data || []).map(mapDbToChannel))
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [user, showError])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const createChannel = useCallback(async (channel: Omit<Channel, 'id'>): Promise<Channel | null> => {
    if (!user) return null

    try {
      const supabase = getSupabaseClient()
      const { data, error: insertError } = await supabase
        .from('channels')
        .insert([mapChannelToDb(channel, user.id)])
        .select()
        .single()

      if (insertError) {
        showError(insertError.message)
        return null
      }

      const newChannel = mapDbToChannel(data)
      setChannels(prev => [newChannel, ...prev])
      return newChannel
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return null
    }
  }, [user, showError])

  const updateChannel = useCallback(async (id: number, updates: Partial<Channel>): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from('channels')
        .update(mapChannelUpdatesToDb(updates))
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError) {
        showError(updateError.message)
        return false
      }

      setChannels(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  const deleteChannel = useCallback(async (id: number): Promise<boolean> => {
    if (!user) return false

    try {
      const supabase = getSupabaseClient()
      const { error: deleteError } = await supabase
        .from('channels')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) {
        showError(deleteError.message)
        return false
      }

      setChannels(prev => prev.filter(c => c.id !== id))
      return true
    } catch (err) {
      showError(err instanceof Error ? err.message : '알 수 없는 오류')
      return false
    }
  }, [user, showError])

  return {
    channels,
    loading,
    error,
    createChannel,
    updateChannel,
    deleteChannel,
    refetch: fetchChannels,
  }
}
