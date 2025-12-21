type TierMetadata = Record<string, unknown> | undefined;

export type TierInfo = {
  tier: string;
  isPro: boolean;
  fallbackTier: string;
};

type ResolveTierArgs = {
  profileTier?: string | null;
  metadata?: TierMetadata;
  defaultFallback?: string;
};

const DEFAULT_FALLBACK_TIER = 'free';

const extractMetadataTier = (metadata?: TierMetadata, fallback: string = DEFAULT_FALLBACK_TIER) => {
  if (!metadata) {
    return fallback;
  }

  const value = metadata.tier;
  if (typeof value === 'string') {
    return value;
  }

  return fallback;
};

export const resolveTier = ({
  profileTier,
  metadata,
  defaultFallback = DEFAULT_FALLBACK_TIER,
}: ResolveTierArgs): TierInfo => {
  const fallbackTier = extractMetadataTier(metadata, defaultFallback);
  const profileValue = profileTier ?? fallbackTier;
  const normalizedValue = typeof profileValue === 'string' ? profileValue : fallbackTier;
  const tier = normalizedValue.toUpperCase();
  return {
    tier,
    isPro: tier === 'PRO',
    fallbackTier,
  };
};
