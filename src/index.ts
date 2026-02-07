import { logger } from './logger';
import { getEnvSecrets } from './config-manager';
import { startWebServer } from './web/server';
import { stopBot } from './bot';

async function main(): Promise<void> {
  const secrets = getEnvSecrets();
  logger.info('Запуск Poll Forwarder — веб-панель...');
  startWebServer(secrets.port);
}

async function shutdown(): Promise<void> {
  logger.info('Завершение работы...');
  try {
    await stopBot();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', async (error) => {
  logger.error(`Необработанное исключение: ${error.message}`);
  logger.error(error.stack || '');
  try { await stopBot(); } catch {}
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Необработанный промис: ${msg}`);
});

main().catch(async (error) => {
  logger.error(`Ошибка запуска: ${error.message}`);
  process.exit(1);
});
