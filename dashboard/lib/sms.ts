import crypto from 'crypto';

const API_KEY    = process.env.SOLAPI_API_KEY    ?? '';
const API_SECRET = process.env.SOLAPI_API_SECRET ?? '';
const SENDER     = process.env.SOLAPI_SENDER     ?? '';

function makeAuth(): string {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidPhone(phone: string): boolean {
  return /^01[016789]\d{7,8}$/.test(phone);
}

export async function sendSms(phones: string[], text: string): Promise<{ sent: number; failed: number }> {
  if (!API_KEY || !API_SECRET || !SENDER) {
    console.warn('[sms] SOLAPI 환경변수 미설정 — SMS 발송 건너뜀');
    return { sent: 0, failed: phones.length };
  }

  const normalized = phones.map(normalizePhone).filter(isValidPhone);
  if (normalized.length === 0) return { sent: 0, failed: phones.length };

  const messages = normalized.map(to => ({
    to,
    from: SENDER,
    text,
    type: 'SMS',
  }));

  const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: makeAuth(),
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[sms] SOLAPI 오류:', res.status, body);
    return { sent: 0, failed: normalized.length };
  }

  const data = await res.json();
  const failed = (data.errorCount ?? 0) as number;
  const sent = normalized.length - failed;
  return { sent, failed };
}
