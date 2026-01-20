'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ProExpiryBannerProps = {
  tierExpiresAt?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const roundToNextHour = (date: Date) => {
  const rounded = new Date(date);
  if (
    rounded.getMinutes() > 0 ||
    rounded.getSeconds() > 0 ||
    rounded.getMilliseconds() > 0
  ) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  } else {
    rounded.setMinutes(0, 0, 0);
  }
  return rounded;
};

const getDayDiff = (from: Date, to: Date) => {
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toStart = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toStart.getTime() - fromStart.getTime()) / DAY_MS);
};

const formatHourLabel = (date: Date, withTodayPrefix: boolean) => {
  const hour = date.getHours();
  if (withTodayPrefix && hour === 0) {
    return '오늘 밤 12시';
  }
  const period = hour >= 12 ? '오후' : '오전';
  const hourLabel = hour % 12 === 0 ? 12 : hour % 12;
  if (withTodayPrefix) {
    return `오늘 ${period} ${hourLabel}시`;
  }
  return `${period} ${hourLabel}시`;
};

export default function ProExpiryBanner({ tierExpiresAt }: ProExpiryBannerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const bannerContent = useMemo(() => {
    if (!tierExpiresAt) return null;
    const parsed = new Date(tierExpiresAt);
    if (Number.isNaN(parsed.getTime())) return null;

    const expiresAt = roundToNextHour(parsed);
    if (expiresAt.getTime() <= now.getTime()) {
      return {
        message: '멤버십이 만료되었습니다. 다시 PRO가 되어보세요! 🚀',
        ctaLabel: '다시 시작하기',
        tone: 'expired',
      };
    }

    const dayDiff = getDayDiff(now, expiresAt);
    if (dayDiff === 0) {
      const timeLabel = formatHourLabel(expiresAt, true);
      return {
        message: `${timeLabel}까지만 PRO 기능을 이용할 수 있어요. ⏳`,
        ctaLabel: '혜택 유지하기',
        tone: 'urgent',
      };
    }

    if (dayDiff >= 1 && dayDiff <= 3) {
      if (dayDiff === 1) {
        return {
          message: '매일 아침 브리핑, 계속 받고 싶으신가요?',
          ctaLabel: '혜택 유지하기',
          tone: 'soon',
        };
      }
      return {
        message: `PRO 멤버십 만료 ${dayDiff}일 전! 혜택이 곧 사라져요.`,
        ctaLabel: '혜택 유지하기',
        tone: 'soon',
      };
    }

    return null;
  }, [now, tierExpiresAt]);

  if (!bannerContent) return null;

  const toneStyles =
    bannerContent.tone === 'expired'
      ? 'border-neutral-300/60 bg-neutral-50 text-neutral-900'
      : bannerContent.tone === 'urgent'
        ? 'border-orange-300/70 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-900'
        : 'border-amber-200/70 bg-amber-50 text-amber-900';

  const buttonStyles =
    bannerContent.tone === 'expired'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
      : 'bg-orange-500 text-white hover:bg-orange-600';

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-[13px] font-semibold shadow-sm ${toneStyles}`}
    >
      <p className="leading-snug">{bannerContent.message}</p>
      <Link
        href="/pricing"
        className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${buttonStyles}`}
        aria-label={bannerContent.ctaLabel}
      >
        {bannerContent.ctaLabel}
      </Link>
    </div>
  );
}
