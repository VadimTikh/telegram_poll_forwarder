import { logger } from './logger';
import { initClient, disconnectClient, isAuthorized, loginWithQr } from './telegram-client';
import { startMonitoring, stopMonitoring } from './poll-monitor';
import { getConfig } from './config-manager';

let running = false;
let connectedSince: Date | null = null;

export async function startBot(): Promise<void> {
  if (running) {
    logger.warn('Бот уже запущен');
    return;
  }

  const config = getConfig();
  if (!config.sourceGroup) {
    throw new Error('Не указана группа для мониторинга');
  }
  if (!config.callPhoneNumber) {
    throw new Error('Не указан номер телефона для звонка');
  }

  logger.info('Запуск бота...');
  logger.info(`Группа-источник: ${config.sourceGroup}`);
  logger.info(`Получатель: ${config.destinationChat}`);

  await initClient();

  const authorized = await isAuthorized();
  if (!authorized) {
    throw new Error('Telegram не авторизован — сначала отсканируйте QR-код');
  }

  startMonitoring();
  running = true;
  connectedSince = new Date();
  logger.info('Бот запущен и ожидает новые опросы');
}

export async function stopBot(): Promise<void> {
  if (!running) {
    logger.warn('Бот не запущен');
    return;
  }

  logger.info('Остановка бота...');
  stopMonitoring();
  await disconnectClient();
  running = false;
  connectedSince = null;
  logger.info('Бот остановлен');
}

export function getBotStatus(): { running: boolean; connectedSince: Date | null } {
  return { running, connectedSince };
}

export async function startQrAuth(
  onQrCode: (qrBase64: string) => void,
): Promise<boolean> {
  // Ensure client is initialized for QR auth
  await initClient();
  return loginWithQr(onQrCode);
}

export async function checkTgAuthorized(): Promise<boolean> {
  try {
    await initClient();
    return await isAuthorized();
  } catch {
    return false;
  }
}
