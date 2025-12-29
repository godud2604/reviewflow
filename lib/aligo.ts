type AligoBaseConfig = {
  apiKey: string;
  userId: string;
};

type AligoSmsConfig = AligoBaseConfig & {
  sender: string;
};

type AligoAlimtalkConfig = AligoBaseConfig & {
  senderKey: string;
  templateCode: string;
  sender: string;
};

type AligoSendResult = {
  resultCode: string;
  message: string;
  raw: Record<string, unknown> | null;
};

const SMS_ENDPOINT = 'https://apis.aligo.in/send/';
const ALIMTALK_ENDPOINT = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

const buildErrorMessage = (result: AligoSendResult) =>
  `${result.message}${result.resultCode ? ` (code: ${result.resultCode})` : ''}`;

const parseAligoResponse = async (res: Response): Promise<AligoSendResult> => {
  const contentType = res.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> | null = null;

  if (contentType.includes('application/json')) {
    payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } else {
    const text = await res.text().catch(() => '');
    payload = text ? { message: text } : null;
  }

  const resultCode = String(payload?.result_code ?? payload?.resultCode ?? '');
  const message = String(payload?.message ?? payload?.msg ?? res.statusText ?? 'Unknown error');

  return { resultCode, message, raw: payload };
};

const assertEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const getSmsConfig = (): AligoSmsConfig => ({
  apiKey: assertEnv(process.env.ALIGO_API_KEY, 'ALIGO_API_KEY'),
  userId: assertEnv(process.env.ALIGO_USER_ID, 'ALIGO_USER_ID'),
  sender: assertEnv(process.env.ALIGO_SENDER, 'ALIGO_SENDER'),
});

const isTestModeEnabled = () => {
  const value = process.env.ALIGO_TEST_MODE;
  if (!value) return false;
  return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'y';
};

const getAlimtalkConfig = (): AligoAlimtalkConfig => ({
  apiKey: assertEnv(process.env.ALIGO_API_KEY, 'ALIGO_API_KEY'),
  userId: assertEnv(process.env.ALIGO_USER_ID, 'ALIGO_USER_ID'),
  senderKey: assertEnv(process.env.ALIGO_KAKAO_SENDER_KEY, 'ALIGO_KAKAO_SENDER_KEY'),
  templateCode: assertEnv(process.env.ALIGO_KAKAO_TEMPLATE_CODE, 'ALIGO_KAKAO_TEMPLATE_CODE'),
  sender: assertEnv(process.env.ALIGO_KAKAO_SENDER, 'ALIGO_KAKAO_SENDER'),
});

export const sendSmsVerification = async (phone: string, message: string) => {
  const config = getSmsConfig();
  const params = new URLSearchParams({
    key: config.apiKey,
    user_id: config.userId,
    sender: config.sender,
    receiver: phone,
    msg: message,
    msg_type: 'SMS',
  });

  if (isTestModeEnabled()) {
    params.set('testmode_yn', 'Y');
  }

  const res = await fetch(SMS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const result = await parseAligoResponse(res);
  if (!res.ok || (result.resultCode && result.resultCode !== '1')) {
    throw new Error(`Aligo SMS failed: ${buildErrorMessage(result)}`);
  }
  return result;
};

export type AlimtalkDailySummaryPayload = {
  phone: string;
  deadlineToday: number;
  visitToday: number;
  overdueCount: number;
};

export const sendDailySummaryAlimtalk = async (payload: AlimtalkDailySummaryPayload) => {
  const config = getAlimtalkConfig();
  const message =
    `[리뷰플로우]\n\n` +
    `좋은 아침이에요 🙂\n` +
    `오늘 예정된 체험단 일정을 정리해서 알려드릴게요.\n\n` +
    `📌 오늘 마감 일정: ${payload.deadlineToday}건\n` +
    `📍 오늘 방문 일정: ${payload.visitToday}건\n` +
    `⏰ 마감 초과 일정: ${payload.overdueCount}건\n\n` +
    `오늘 하루도 천천히 화이팅이에요 💛`;

  const params = new URLSearchParams({
    key: config.apiKey,
    user_id: config.userId,
    senderkey: config.senderKey,
    tpl_code: config.templateCode,
    sender: config.sender,
    receiver_1: payload.phone,
    message_1: message,
  });

  const res = await fetch(ALIMTALK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const result = await parseAligoResponse(res);
  if (!res.ok || (result.resultCode && result.resultCode !== '1')) {
    throw new Error(`Aligo Alimtalk failed: ${buildErrorMessage(result)}`);
  }
};
