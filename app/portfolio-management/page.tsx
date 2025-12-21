'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile, type CampaignEntry, type SocialLinks } from '@/hooks/use-user-profile';
import { uploadProfileImage, deleteProfileImage, getProfileImageUrl } from '@/lib/storage';
import { Bell, Camera, ChevronLeft, FileText, Share2, Shield } from 'lucide-react';

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'blog', label: '블로그' },
  { key: 'threads', label: 'Threads' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
];

type SocialDraft = Record<keyof SocialLinks, string>;

export default function PortfolioManagementPage() {
  const router = useRouter();
  const {
    profile,
    socialLinks,
    recentCampaigns,
    updateSocialLinks,
    updateRecentCampaigns,
    updateNickname,
    updateProfileImagePath,
    loading,
    refetch,
  } = useUserProfile();
  const { toast } = useToast();

  const [socialDraft, setSocialDraft] = useState<SocialDraft>({
    blog: '',
    threads: '',
    instagram: '',
    tiktok: '',
    youtube: '',
  });
  const [campaignDrafts, setCampaignDrafts] = useState<CampaignEntry[]>([]);
  const [campaignPlatform, setCampaignPlatform] = useState('');
  const [campaignUrl, setCampaignUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [isSavingCampaignEntry, setIsSavingCampaignEntry] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSocialDraft({
      blog: socialLinks.blog ?? '',
      threads: socialLinks.threads ?? '',
      instagram: socialLinks.instagram ?? '',
      tiktok: socialLinks.tiktok ?? '',
      youtube: socialLinks.youtube ?? '',
    });
  }, [socialLinks]);

  useEffect(() => {
    setCampaignDrafts([...recentCampaigns]);
  }, [recentCampaigns]);

  useEffect(() => {
    setNickname(profile?.nickname ?? '');
  }, [profile?.nickname]);

  useEffect(() => {
    if (!profile?.profileImagePath) {
      setProfileImageUrl(null);
      return;
    }

    let isCurrent = true;
    getProfileImageUrl(profile.profileImagePath)
      .then((url) => {
        if (isCurrent) {
          setProfileImageUrl(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setProfileImageUrl(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [profile?.profileImagePath]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const displayedImage = avatarPreview ?? profileImageUrl ?? '/api/placeholder/100/100';
  const isInitialLoading = loading && !profile;

  const handleAddCampaign = async () => {
    const platform = campaignPlatform.trim();
    const url = campaignUrl.trim();
    if (!platform || !url) {
      toast({
        title: '플랫폼과 URL을 모두 입력해 주세요.',
        variant: 'destructive',
        duration: 2000,
      });
      return;
    }
    const updatedCampaigns = [...campaignDrafts, { platform, url }];
    setCampaignDrafts(updatedCampaigns);
    setCampaignPlatform('');
    setCampaignUrl('');

    if (!updateRecentCampaigns) return;

    setIsSavingCampaignEntry(true);
    try {
      const success = await updateRecentCampaigns(updatedCampaigns);
      if (success) {
        toast({
          title: '캠페인 활동이 저장되었습니다.',
          duration: 1500,
        });
        void refetch().catch(() => {});
      } else {
        toast({
          title: '캠페인 저장에 실패했습니다.',
          variant: 'destructive',
          duration: 2000,
        });
      }
    } catch (error) {
      toast({
        title: '캠페인 저장에 실패했습니다.',
        description: error instanceof Error ? error.message : '다시 시도해주세요.',
        variant: 'destructive',
        duration: 2500,
      });
    } finally {
      setIsSavingCampaignEntry(false);
    }
  };

  const handleRemoveCampaign = (index: number) => {
    setCampaignDrafts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitPortfolio = async () => {
    if (!updateSocialLinks || !updateRecentCampaigns) return;
    setIsSavingPortfolio(true);
    try {
      await Promise.all([
        updateSocialLinks({
          blog: socialDraft.blog.trim() || null,
          threads: socialDraft.threads.trim() || null,
          instagram: socialDraft.instagram.trim() || null,
          tiktok: socialDraft.tiktok.trim() || null,
          youtube: socialDraft.youtube.trim() || null,
        }),
        updateRecentCampaigns(campaignDrafts),
      ]);
      toast({
        title: '포트폴리오 업데이트 완료',
        duration: 2000,
      });
      void refetch().catch(() => {});
    } catch (error) {
      toast({
        title: '포트폴리오 저장에 실패했습니다.',
        description: error instanceof Error ? error.message : '다시 시도해주세요.',
        variant: 'destructive',
        duration: 2500,
      });
    } finally {
      setIsSavingPortfolio(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!updateNickname) return;
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast({ title: '닉네임을 입력해 주세요.', variant: 'destructive' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const success = await updateNickname(trimmed);
      if (success) {
        toast({ title: '닉네임이 저장되었습니다.' });
      }
    } catch {
      toast({ title: '닉네임 저장에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !updateProfileImagePath || !profile?.id) return;

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setIsUploadingImage(true);

    try {
      const uploaded = await uploadProfileImage(profile.id, file);
      await updateProfileImagePath(uploaded.path);
      toast({ title: '프로필 사진이 저장되었습니다.' });
    } catch {
      toast({ title: '사진 업로드에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.profileImagePath || !updateProfileImagePath) return;
    setIsRemovingImage(true);

    try {
      await deleteProfileImage(profile.profileImagePath);
    } catch (error) {
      console.error(error);
    }

    try {
      const success = await updateProfileImagePath(null);
      if (success) {
        toast({ title: '프로필 사진이 삭제되었습니다.' });
        setAvatarPreview(null);
      }
    } catch {
      toast({ title: '사진 삭제에 실패했습니다.', variant: 'destructive' });
    } finally {
      setIsRemovingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] pb-24 md:px-4">
      <div className="mx-auto flex w-full max-w-[600px] flex-col space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/?page=profile')}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
          >
            <ChevronLeft size={16} />
            프로필로 돌아가기
          </button>
        </div>
        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm border border-neutral-100">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div
                className={`h-28 w-28 rounded-full border-2 border-dashed border-neutral-200 p-1 ${!profileImageUrl && !avatarPreview ? 'bg-gradient-to-tr from-orange-100 to-orange-50' : 'bg-white shadow-md'}`}
              >
                {profileImageUrl ? (
                  <img
                    src={displayedImage}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full text-[13px] font-semibold text-neutral-400">
                    <span className="text-[11px] uppercase tracking-[0.25em] text-[11px]">
                      Profile
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="absolute bottom-0 right-0 flex h-9 w-9 translate-x-2 translate-y-2 items-center justify-center rounded-full bg-[#ff5c39] text-white shadow-lg"
              >
                <Camera size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex w-full flex-col gap-3">
              <input
                type="text"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900 focus:border-[#ff5c39] focus:outline-none"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="활동할 닉네임"
                disabled={isInitialLoading}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 rounded-2xl bg-[#ff5c39] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(255,92,57,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {isSavingProfile ? '저장 중...' : '닉네임 저장'}
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isRemovingImage || (!profile?.profileImagePath && !avatarPreview)}
                  className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-500 transition hover:border-neutral-300 disabled:opacity-40"
                >
                  {isRemovingImage ? '삭제 중...' : '사진 삭제'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm border border-neutral-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-800">SNS 계정 연동</p>
              <p className="text-[13px] text-neutral-500">
                연결된 채널 정보를 바탕으로 나만의 포트폴리오가 구성됩니다.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {SOCIAL_FIELDS.map((field) => (
              <label key={field.key} className="text-[12px] text-neutral-500">
                <span className="mb-1 block text-[12px] font-semibold text-neutral-500">{field.label}</span>
                <input
                  type="text"
                  placeholder="계정 링크 또는 아이디"
                  value={socialDraft[field.key] ?? ""}
                  onChange={(e) =>
                    setSocialDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c39]"
                  disabled={isInitialLoading}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm border border-neutral-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-800">캠페인 활동 이력</p>
              <p className="text-[13px] text-neutral-500">
                진행했던 캠페인 URL을 등록하고 성과를 기록하세요.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {campaignDrafts.map((campaign, idx) => (
              <div
                key={`${campaign.platform}-${campaign.url}-${idx}`}
                className="rounded-2xl border border-neutral-200 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-neutral-900">{campaign.platform}</p>
                    <p className="text-[13px] text-neutral-500 break-words">{campaign.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCampaign(idx)}
                    className="self-start flex-shrink-0 text-[11px] font-semibold text-red-500"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="SNS 플랫폼 (예: 인스타)"
              value={campaignPlatform}
              onChange={(e) => setCampaignPlatform(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c39]"
              disabled={isInitialLoading}
            />
            <input
              type="url"
              placeholder="캠페인 URL"
              value={campaignUrl}
              onChange={(e) => setCampaignUrl(e.target.value)}
              className="w-full rounded-2xl border border-neutral-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5c39]"
              disabled={isInitialLoading}
            />
          </div>
          <button
            type="button"
            onClick={handleAddCampaign}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#ff5c39] hover:text-[#ff5c39]"
            disabled={isSavingCampaignEntry || isInitialLoading}
          >
            {isSavingCampaignEntry ? "저장 중..." : "캠페인 추가"}
          </button>
          <p className="text-[11px] text-neutral-400">
            캠페인 추가 시 자동으로 저장됩니다. (SNS 링크 등은 아래 버튼으로 따로 저장)
          </p>
        </section>

        <button
          type="button"
          onClick={handleSubmitPortfolio}
          disabled={isSavingPortfolio || loading}
          className="w-full rounded-2xl bg-[#ff5c39] px-4 py-4 text-sm font-semibold text-white shadow-lg shadow-orange-400/30 transition hover:bg-[#ff734f] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSavingPortfolio ? "저장 중..." : "포트폴리오 업데이트 완료"}
        </button> */}
      </div>
    </div>
  );
}
