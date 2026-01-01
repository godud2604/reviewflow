const LEGACY_MEMO_PREFIX = '[asset_meta]';

export const stripLegacyScheduleMemo = (memo?: string | null) => {
  if (!memo) return '';
  if (!memo.startsWith(LEGACY_MEMO_PREFIX)) return memo;
  const newlineIndex = memo.indexOf('\n');
  if (newlineIndex === -1) return '';
  return memo.slice(newlineIndex + 1);
};
