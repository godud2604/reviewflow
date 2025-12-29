'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { DEFAULT_SCHEDULE_CHANNEL_OPTIONS } from '@/lib/schedule-channels';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

const DEFAULT_PLATFORMS = ['레뷰', '리뷰노트', '스타일씨', '리뷰플레이스'];
const DEFAULT_CATEGORIES = [
  '맛집/식품',
  '뷰티',
  '출산/육아',
  '반려동물',
  '생활/리빙',
  '주방/가전',
] as const;

export type CampaignEntry = {
  platform: string;
  url: string;
};

export type SocialLinks = {
  blog: string | null;
  threads: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
};

export interface UserProfile {
  id: string;
  nickname: string | null;
  platforms: string[];
  categories: string[];
  scheduleChannels: string[];
  profileImagePath: string | null;
  phoneNumber: string | null;
  phoneVerifiedAt: string | null;
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  dailySummaryMinute: number;
  snsBlog: string | null;
  snsThreads: string | null;
  snsInstagram: string | null;
  snsTiktok: string | null;
  snsYoutube: string | null;
  recentCampaigns: CampaignEntry[];
  tier: string;
  tierDurationMonths: number;
  tierExpiresAt: string | null;
}

interface UseUserProfileOptions {
  enabled?: boolean;
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  platforms: string[];
  categories: string[];
  scheduleChannels: string[];
  profileImagePath: string | null;
  socialLinks: SocialLinks;
  recentCampaigns: CampaignEntry[];
  loading: boolean;
  error: string | null;
  addPlatform: (platform: string) => Promise<boolean>;
  removePlatform: (platform: string) => Promise<boolean>;
  addScheduleChannel: (channel: string) => Promise<boolean>;
  removeScheduleChannel: (channel: string) => Promise<boolean>;
  updateNickname: (nickname: string) => Promise<boolean>;
  updateCategories: (categories: string[]) => Promise<boolean>;
  updateProfileImagePath: (path: string | null) => Promise<boolean>;
  updateSocialLinks: (links: SocialLinks) => Promise<boolean>;
  updateRecentCampaigns: (campaigns: CampaignEntry[]) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useUserProfile(options: UseUserProfileOptions = {}): UseUserProfileReturn {
  const { enabled = true } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = React.useRef(false);

  const userId = user?.id;

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

  const fetchProfile = useCallback(
    async (force = false) => {
      if (!userId) {
        setProfile(null);
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
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) {
          // 프로필이 없으면 생성 (기본 플랫폼 포함)
          if (fetchError.code === 'PGRST116') {
            const { data: newProfile, error: insertError } = await supabase
              .from('user_profiles')
              .insert([
                { id: userId, platforms: DEFAULT_PLATFORMS, categories: DEFAULT_CATEGORIES },
              ])
              .select()
              .single();

            if (insertError) {
              showError(insertError.message);
              setProfile(null);
            } else {
              setProfile({
                id: newProfile.id,
                nickname: newProfile.nickname,
                platforms: newProfile.platforms || DEFAULT_PLATFORMS,
                categories: newProfile.categories || [...DEFAULT_CATEGORIES],
                scheduleChannels:
                  newProfile.schedule_channels && newProfile.schedule_channels.length > 0
                    ? newProfile.schedule_channels
                    : DEFAULT_SCHEDULE_CHANNEL_OPTIONS,
                profileImagePath: newProfile.profile_image_path ?? null,
                phoneNumber: newProfile.phone_number ?? null,
                phoneVerifiedAt: newProfile.phone_verified_at ?? null,
                dailySummaryEnabled: newProfile.daily_summary_enabled ?? false,
                dailySummaryHour: newProfile.daily_summary_hour ?? 8,
                dailySummaryMinute: newProfile.daily_summary_minute ?? 0,
                snsBlog: newProfile.sns_blog ?? null,
                snsThreads: newProfile.sns_threads ?? null,
                snsInstagram: newProfile.sns_instagram ?? null,
                snsTiktok: newProfile.sns_tiktok ?? null,
                snsYoutube: newProfile.sns_youtube ?? null,
                recentCampaigns: Array.isArray(newProfile.recent_campaigns)
                  ? newProfile.recent_campaigns
                  : [],
                tier: newProfile.tier ?? 'free',
                tierDurationMonths: newProfile.tier_duration_months ?? 0,
                tierExpiresAt: newProfile.tier_expires_at ?? null,
              });
              hasFetchedRef.current = true;
            }
          } else {
            showError(fetchError.message);
            setProfile(null);
          }
        } else {
          setProfile({
            id: data.id,
            nickname: data.nickname,
            platforms: data.platforms || DEFAULT_PLATFORMS,
            categories:
              data.categories && data.categories.length > 0
                ? data.categories
                : [...DEFAULT_CATEGORIES],
            scheduleChannels:
              data.schedule_channels && data.schedule_channels.length > 0
                ? data.schedule_channels
                : DEFAULT_SCHEDULE_CHANNEL_OPTIONS,
            profileImagePath: data.profile_image_path ?? null,
            phoneNumber: data.phone_number ?? null,
            phoneVerifiedAt: data.phone_verified_at ?? null,
            dailySummaryEnabled: data.daily_summary_enabled ?? false,
            dailySummaryHour: data.daily_summary_hour ?? 8,
            dailySummaryMinute: data.daily_summary_minute ?? 0,
            snsBlog: data.sns_blog ?? null,
            snsThreads: data.sns_threads ?? null,
            snsInstagram: data.sns_instagram ?? null,
            snsTiktok: data.sns_tiktok ?? null,
            snsYoutube: data.sns_youtube ?? null,
            recentCampaigns: Array.isArray(data.recent_campaigns) ? data.recent_campaigns : [],
            tier: data.tier ?? 'free',
            tierDurationMonths: data.tier_duration_months ?? 0,
            tierExpiresAt: data.tier_expires_at ?? null,
          });
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
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchProfile]);

  const addPlatform = useCallback(
    async (platform: string): Promise<boolean> => {
      if (!userId || !profile) return false;

      const trimmedPlatform = platform.trim();
      if (!trimmedPlatform) return false;

      // 중복 체크
      if (profile.platforms.includes(trimmedPlatform)) {
        toast({
          title: '이미 등록된 플랫폼입니다.',
          variant: 'destructive',
          duration: 1000,
        });
        return false;
      }

      const newPlatforms = [...profile.platforms, trimmedPlatform];

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ platforms: newPlatforms })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, platforms: newPlatforms });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError, toast]
  );

  const removePlatform = useCallback(
    async (platform: string): Promise<boolean> => {
      if (!userId || !profile) return false;

      const newPlatforms = profile.platforms.filter((p) => p !== platform);

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ platforms: newPlatforms })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, platforms: newPlatforms });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const addScheduleChannel = useCallback(
    async (channel: string): Promise<boolean> => {
      if (!userId || !profile) return false;

      const trimmedChannel = channel.trim();
      if (!trimmedChannel) return false;

      const exists = profile.scheduleChannels.some(
        (existing) => existing.toLowerCase() === trimmedChannel.toLowerCase()
      );
      if (exists) {
        toast({
          title: '이미 등록된 작성할 곳입니다.',
          variant: 'destructive',
          duration: 1000,
        });
        return false;
      }

      const newChannels = [...profile.scheduleChannels, trimmedChannel];

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ schedule_channels: newChannels })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, scheduleChannels: newChannels });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError, toast]
  );

  const removeScheduleChannel = useCallback(
    async (channel: string): Promise<boolean> => {
      if (!userId || !profile) return false;

      const newChannels = profile.scheduleChannels.filter((value) => value !== channel);

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ schedule_channels: newChannels })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, scheduleChannels: newChannels });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const updateNickname = useCallback(
    async (nickname: string): Promise<boolean> => {
      if (!userId || !profile) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ nickname })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, nickname });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const updateProfileImagePath = useCallback(
    async (path: string | null): Promise<boolean> => {
      if (!userId || !profile) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ profile_image_path: path })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, profileImagePath: path });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const updateSocialLinks = useCallback(
    async (links: SocialLinks): Promise<boolean> => {
      if (!userId || !profile) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            sns_blog: links.blog ?? null,
            sns_threads: links.threads ?? null,
            sns_instagram: links.instagram ?? null,
            sns_tiktok: links.tiktok ?? null,
            sns_youtube: links.youtube ?? null,
          })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({
          ...profile,
          snsBlog: links.blog ?? null,
          snsThreads: links.threads ?? null,
          snsInstagram: links.instagram ?? null,
          snsTiktok: links.tiktok ?? null,
          snsYoutube: links.youtube ?? null,
        });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const updateRecentCampaigns = useCallback(
    async (campaigns: CampaignEntry[]): Promise<boolean> => {
      if (!userId || !profile) return false;

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ recent_campaigns: campaigns })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, recentCampaigns: campaigns });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const updateCategories = useCallback(
    async (categories: string[]): Promise<boolean> => {
      if (!userId || !profile) return false;

      const cleaned = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));

      try {
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ categories: cleaned })
          .eq('id', userId);

        if (updateError) {
          showError(updateError.message);
          return false;
        }

        setProfile({ ...profile, categories: cleaned });
        return true;
      } catch (err) {
        showError(err instanceof Error ? err.message : '알 수 없는 오류');
        return false;
      }
    },
    [userId, profile, showError]
  );

  const socialLinks = useMemo(
    () => ({
      blog: profile?.snsBlog ?? null,
      threads: profile?.snsThreads ?? null,
      instagram: profile?.snsInstagram ?? null,
      tiktok: profile?.snsTiktok ?? null,
      youtube: profile?.snsYoutube ?? null,
    }),
    [
      profile?.snsBlog,
      profile?.snsThreads,
      profile?.snsInstagram,
      profile?.snsTiktok,
      profile?.snsYoutube,
    ]
  );

  const memoizedRecentCampaigns = useMemo(
    () => profile?.recentCampaigns ?? [],
    [profile?.recentCampaigns]
  );

  return {
    profile,
    platforms: profile?.platforms || [],
    categories: profile?.categories || [],
    scheduleChannels: profile?.scheduleChannels || [],
    profileImagePath: profile?.profileImagePath ?? null,
    socialLinks,
    recentCampaigns: memoizedRecentCampaigns,
    loading,
    error,
    addPlatform,
    removePlatform,
    addScheduleChannel,
    removeScheduleChannel,
    updateNickname,
    updateCategories,
    updateProfileImagePath,
    updateSocialLinks,
    updateRecentCampaigns,
    refetch: () => fetchProfile(true),
  };
}
