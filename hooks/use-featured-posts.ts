'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import type { FeaturedPost } from '@/types';
import type { DbFeaturedPost } from '@/types/database';

interface UseFeaturedPostsOptions {
  enabled?: boolean;
}

interface UseFeaturedPostsReturn {
  featuredPosts: FeaturedPost[];
  loading: boolean;
  error: string | null;
  createFeaturedPost: (post: Omit<FeaturedPost, 'id'>) => Promise<FeaturedPost | null>;
  updateFeaturedPost: (id: number, updates: Partial<FeaturedPost>) => Promise<boolean>;
  deleteFeaturedPost: (id: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// DB -> Frontend 매핑
function mapDbToFeaturedPost(db: DbFeaturedPost): FeaturedPost {
  return {
    id: db.id,
    title: db.title,
    thumbnail: db.thumbnail || '',
    url: db.url || '',
    views: db.views || 0,
    channel: db.channel || '',
  };
}

// Frontend -> DB 매핑 (Insert)
function mapFeaturedPostToDb(post: Omit<FeaturedPost, 'id'>, userId: string) {
  return {
    user_id: userId,
    title: post.title,
    thumbnail: post.thumbnail || null,
    url: post.url || null,
    views: post.views || 0,
    channel: post.channel || null,
  };
}

// Frontend -> DB 매핑 (Update)
function mapFeaturedPostUpdatesToDb(updates: Partial<FeaturedPost>) {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.thumbnail !== undefined) dbUpdates.thumbnail = updates.thumbnail;
  if (updates.url !== undefined) dbUpdates.url = updates.url;
  if (updates.views !== undefined) dbUpdates.views = updates.views;
  if (updates.channel !== undefined) dbUpdates.channel = updates.channel;

  return dbUpdates;
}

export function useFeaturedPosts(options: UseFeaturedPostsOptions = {}): UseFeaturedPostsReturn {
  const { enabled = true } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
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

  const fetchFeaturedPosts = useCallback(
    async (force = false) => {
      if (!userId) {
        setFeaturedPosts([]);
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
          .from('featured_posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          showError(fetchError.message);
          setFeaturedPosts([]);
        } else {
          setFeaturedPosts((data || []).map(mapDbToFeaturedPost));
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
      fetchFeaturedPosts();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchFeaturedPosts]);

  const createFeaturedPost = useCallback(
    async (post: Omit<FeaturedPost, 'id'>): Promise<FeaturedPost | null> => {
      if (!user) return null;

      try {
        const supabase = getSupabaseClient();
        const { data, error: insertError } = await supabase
          .from('featured_posts')
          .insert([mapFeaturedPostToDb(post, user.id)])
          .select()
          .single();

        if (insertError) {
          showError(insertError.message);
          return null;
        }

        const newPost = mapDbToFeaturedPost(data);
        setFeaturedPosts((prev) => [newPost, ...prev]);
        return newPost;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return null;
      }
    },
    [user, showError]
  );

  const updateFeaturedPost = useCallback(
    async (id: number, updates: Partial<FeaturedPost>): Promise<boolean> => {
      if (!user) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('featured_posts')
          .update(mapFeaturedPostUpdatesToDb(updates))
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setFeaturedPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError]
  );

  const deleteFeaturedPost = useCallback(
    async (id: number): Promise<boolean> => {
      if (!user) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: deleteError } = await supabase
          .from('featured_posts')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) {
          showError(deleteError.message);
          return false;
        }

        setFeaturedPosts((prev) => prev.filter((p) => p.id !== id));
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [user, showError]
  );

  return {
    featuredPosts,
    loading,
    error,
    createFeaturedPost,
    updateFeaturedPost,
    deleteFeaturedPost,
    refetch: () => fetchFeaturedPosts(true),
  };
}
