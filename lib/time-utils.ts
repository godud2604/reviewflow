export const formatKoreanTime = (timeStr?: string) => {
  if (!timeStr) return '';
  const [rawHour, rawMinute] = timeStr.split(':');
  const hourNum = Number(rawHour);
  const minuteNum = Number(rawMinute);

  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) {
    return timeStr;
  }

  const period = hourNum < 12 ? '오전' : '오후';
  const hour = hourNum % 12 === 0 ? 12 : hourNum % 12;
  const minute = String(minuteNum).padStart(2, '0');

  if (minute === '00') {
    return `${period} ${hour}시`;
  }

  return `${period} ${hour}시 ${minute}분`;
};
