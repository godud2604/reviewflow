export const parseDateString = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const getDaysDiff = (todayStr: string, targetDateStr?: string) => {
  if (!targetDateStr) return 999;
  const today = parseDateString(todayStr);
  const target = parseDateString(targetDateStr);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDateStringKST = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

