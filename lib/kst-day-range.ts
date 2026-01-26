const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDayRangeUtc(now: Date = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);

  const startKst = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0, 0)
  );
  const endKst = new Date(startKst.getTime() + 24 * 60 * 60 * 1000);

  const startUtc = new Date(startKst.getTime() - KST_OFFSET_MS);
  const endUtc = new Date(endKst.getTime() - KST_OFFSET_MS);

  return { startUtc, endUtc };
}

