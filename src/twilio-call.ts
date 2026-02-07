import axios from 'axios';
import { buildConfig } from './config';
import { logger } from './logger';

let lastCallTime = 0;

export async function triggerCall(): Promise<boolean> {
  const config = buildConfig();
  const now = Date.now();
  const elapsed = now - lastCallTime;

  if (lastCallTime > 0 && elapsed < config.callCooldownMs) {
    const remaining = Math.ceil((config.callCooldownMs - elapsed) / 1000);
    logger.warn(`Звонок пропущен: кулдаун ещё ${remaining}с`);
    return false;
  }

  try {
    logger.info('Инициируем звонок через Twilio...');

    const { accountSid, authToken, fromNumber, callPhoneNumber } = config.twilio;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const params = new URLSearchParams({
      To: callPhoneNumber,
      From: fromNumber,
      Twiml: '<Response><Say language="ru-RU">Внимание! Новый опрос в группе Телеграм!</Say><Pause length="1"/><Say language="ru-RU">Проверьте Телеграм.</Say></Response>',
    });

    const response = await axios.post(url, params.toString(), {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    lastCallTime = Date.now();
    logger.info(`Twilio ответ: sid=${response.data.sid}, status=${response.data.status}`);
    return true;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(`Ошибка звонка Twilio: ${error.response.status} ${JSON.stringify(error.response.data)}`);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Ошибка звонка Twilio: ${msg}`);
    }
    return false;
  }
}
