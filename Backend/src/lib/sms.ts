import { env } from '../config/env.js';
import { HttpError, logger } from './core.js';

const INDIA_HUB_ENDPOINT = 'http://cloud.smsindiahub.in/api/mt/SendSMS';

/** Sends an OTP through SMS India Hub (DLT-registered transactional route). */
export async function sendOtpSms(mobile: string, otp: string) {
  const apiKey = env.SMS_INDIA_HUB_API_KEY;
  if (!apiKey) throw new HttpError(500, 'SMS_NOT_CONFIGURED', 'SMS India Hub API key is not configured');

  const url = new URL(INDIA_HUB_ENDPOINT);
  url.searchParams.set('APIKey', apiKey);
  url.searchParams.set('senderid', env.SMS_INDIA_HUB_SENDER_ID ?? 'SMSHUB');
  url.searchParams.set('channel', 'Trans');
  url.searchParams.set('DCS', '0');
  url.searchParams.set('flashsms', '0');
  url.searchParams.set('number', `91${mobile}`);
  // Text must match the DLT template exactly; {otp} is replaced with the code.
  url.searchParams.set('text', env.SMS_INDIA_HUB_OTP_MESSAGE.replace('{otp}', otp));
  if (env.SMS_INDIA_HUB_DLT_TEMPLATE_ID) url.searchParams.set('TemplateId', env.SMS_INDIA_HUB_DLT_TEMPLATE_ID);
  if (env.SMS_INDIA_HUB_PEID) url.searchParams.set('PEID', env.SMS_INDIA_HUB_PEID);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const text = (await res.text()).trim();
  let errorCode: string | undefined;
  try {
    errorCode = String(JSON.parse(text)?.ErrorCode ?? '');
  } catch {
    /* non-JSON response */
  }
  const ok = res.ok && (errorCode === '000' || (errorCode === undefined && !/error|invalid|failed|unauthor|reject/i.test(text)));
  if (!ok) {
    logger.error({ status: res.status, text }, 'SMS India Hub rejected OTP');
    throw new HttpError(502, 'SMS_FAILED', 'Could not send OTP. Please try again.');
  }
  logger.info({ to: `******${mobile.slice(-4)}` }, 'OTP SMS sent');
}
