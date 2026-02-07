import fs from 'fs';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import QRCode from 'qrcode';
import { getEnvSecrets } from './config-manager';
import { logger } from './logger';

const SESSION_FILE = path.join(process.cwd(), 'session.txt');

let client: TelegramClient | null = null;

// Callback for delivering QR code to web panel
let qrCodeCallback: ((qrBase64: string) => void) | null = null;
let authResolve: ((success: boolean) => void) | null = null;

function loadSession(): StringSession {
  if (fs.existsSync(SESSION_FILE)) {
    const sessionData = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
    if (sessionData) {
      logger.info('Загружена сохранённая сессия');
      return new StringSession(sessionData);
    }
  }
  logger.info('Сессия не найдена, потребуется авторизация');
  return new StringSession('');
}

function saveSession(session: StringSession): void {
  const sessionData = session.save();
  fs.writeFileSync(SESSION_FILE, sessionData, 'utf-8');
  logger.info('Сессия сохранена в session.txt');
}

export async function initClient(): Promise<TelegramClient> {
  const secrets = getEnvSecrets();
  const session = loadSession();

  client = new TelegramClient(session, secrets.tgApiId, secrets.tgApiHash, {
    connectionRetries: 5,
    deviceModel: 'Samsung Galaxy S23',
    systemVersion: 'Android 13',
    appVersion: '10.0.1',
  });

  await client.connect();

  if (await client.isUserAuthorized()) {
    logger.info('Авторизация через сохранённую сессию');
    saveSession(client.session as StringSession);
  }

  return client;
}

export async function loginWithQr(
  onQrCode: (qrBase64: string) => void,
): Promise<boolean> {
  if (!client) {
    throw new Error('Telegram клиент не инициализирован');
  }

  if (await client.isUserAuthorized()) {
    logger.info('Уже авторизован');
    return true;
  }

  const secrets = getEnvSecrets();

  return new Promise<boolean>((resolve) => {
    authResolve = resolve;

    client!.signInUserWithQrCode(
      { apiId: secrets.tgApiId, apiHash: secrets.tgApiHash },
      {
        qrCode: async (code) => {
          const url = `tg://login?token=${code.token.toString('base64url')}`;
          try {
            const qrBase64 = await QRCode.toDataURL(url, { width: 256, margin: 2 });
            onQrCode(qrBase64);
          } catch (err) {
            logger.error(`Ошибка генерации QR-кода: ${err}`);
          }
        },
        password: async () => {
          // 2FA not supported via web panel — user must disable 2FA or use terminal
          logger.error('Требуется пароль 2FA — веб-панель не поддерживает ввод пароля');
          throw new Error('2FA_REQUIRED');
        },
        onError: (err) => {
          logger.error(`Ошибка авторизации: ${err.message}`);
          if (authResolve) {
            authResolve(false);
            authResolve = null;
          }
        },
      },
    ).then(() => {
      saveSession(client!.session as StringSession);
      logger.info('Telegram авторизация успешна через QR-код');
      if (authResolve) {
        authResolve(true);
        authResolve = null;
      }
    }).catch((err) => {
      logger.error(`Ошибка QR авторизации: ${err.message}`);
      if (authResolve) {
        authResolve(false);
        authResolve = null;
      }
    });
  });
}

export async function isAuthorized(): Promise<boolean> {
  if (!client) return false;
  try {
    return await client.isUserAuthorized();
  } catch {
    return false;
  }
}

export function getClient(): TelegramClient {
  if (!client) {
    throw new Error('Telegram клиент не инициализирован');
  }
  return client;
}

export async function disconnectClient(): Promise<void> {
  if (client) {
    await client.disconnect();
    logger.info('Telegram клиент отключён');
    client = null;
  }
}
