import { Api } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { buildConfig } from './config';
import { logger } from './logger';
import { getClient } from './telegram-client';
import { triggerCall } from './twilio-call';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function handleNewMessage(event: NewMessageEvent): Promise<void> {
  const message = event.message;

  if (!(message.media instanceof Api.MessageMediaPoll)) {
    return;
  }

  const poll = message.media.poll;
  const question = poll.question.text;
  const options = poll.answers.map((a: Api.PollAnswer) => a.text.text);

  logger.info(`Обнаружен опрос: "${question}"`);
  logger.info(`Варианты: ${options.join(', ')}`);

  const client = getClient();
  const config = buildConfig();
  const destination = config.tg.destinationChat;
  const source = config.tg.sourceGroup;

  // Random delay 1-3s for natural behavior
  await randomDelay(1000, 3000);

  // Forward original poll message
  try {
    await client.forwardMessages(destination, {
      messages: [message.id],
      fromPeer: source,
    });
    logger.info('Опрос переслан');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Ошибка пересылки опроса: ${msg}`);
  }

  // Send text notification
  try {
    const optionsList = options.map((o, i) => `  ${i + 1}. ${o}`).join('\n');
    const text = `🔔 Новый опрос!\n\nВопрос: ${question}\n\nВарианты:\n${optionsList}`;
    await client.sendMessage(destination, { message: text });
    logger.info('Текстовое уведомление отправлено');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Ошибка отправки уведомления: ${msg}`);
  }

  // Trigger phone call
  try {
    await triggerCall();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Ошибка вызова triggerCall: ${msg}`);
  }
}

let eventHandler: any = null;

export function startMonitoring(): void {
  const client = getClient();
  const config = buildConfig();

  const handler = new NewMessage({
    chats: [config.tg.sourceGroup],
  });

  eventHandler = handleNewMessage;
  client.addEventHandler(eventHandler, handler);

  logger.info(`Мониторинг запущен для группы: ${config.tg.sourceGroup}`);
  logger.info(`Пересылка в: ${config.tg.destinationChat}`);
}

export function stopMonitoring(): void {
  if (eventHandler) {
    try {
      const client = getClient();
      client.removeEventHandler(eventHandler, new NewMessage({}));
    } catch {
      // Client may already be disconnected
    }
    eventHandler = null;
    logger.info('Мониторинг остановлен');
  }
}
