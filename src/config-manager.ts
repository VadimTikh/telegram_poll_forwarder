import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const CONFIG_FILE = path.join(process.cwd(), 'data', 'config.json');

export interface UserConfig {
  sourceGroup: string;
  destinationChat: string;
  callPhoneNumber: string;
  callCooldownSeconds: number;
}

export interface EnvSecrets {
  tgApiId: number;
  tgApiHash: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  adminPassword: string;
  port: number;
}

const defaultUserConfig: UserConfig = {
  sourceGroup: '',
  destinationChat: 'me',
  callPhoneNumber: '',
  callCooldownSeconds: 60,
};

let currentConfig: UserConfig = { ...defaultUserConfig };

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnvSecrets(): EnvSecrets {
  return {
    tgApiId: Number(getEnvOrThrow('TG_API_ID')),
    tgApiHash: getEnvOrThrow('TG_API_HASH'),
    twilioAccountSid: getEnvOrThrow('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: getEnvOrThrow('TWILIO_AUTH_TOKEN'),
    twilioPhoneNumber: getEnvOrThrow('TWILIO_PHONE_NUMBER'),
    adminPassword: getEnvOrThrow('ADMIN_PASSWORD'),
    port: Number(process.env.PORT || '3000'),
  };
}

export function loadConfig(): UserConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(raw) as Partial<UserConfig>;
      currentConfig = { ...defaultUserConfig, ...saved };
      logger.info('Конфигурация загружена из data/config.json');
    } else {
      currentConfig = { ...defaultUserConfig };
      logger.info('Файл конфигурации не найден, используются значения по умолчанию');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Ошибка загрузки конфигурации: ${msg}`);
    currentConfig = { ...defaultUserConfig };
  }
  return currentConfig;
}

export function saveConfig(data: Partial<UserConfig>): UserConfig {
  currentConfig = { ...currentConfig, ...data };

  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
  logger.info('Конфигурация сохранена в data/config.json');
  return currentConfig;
}

export function getConfig(): UserConfig {
  return { ...currentConfig };
}
