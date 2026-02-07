# Telegram Poll Forwarder

Бот мониторит Telegram-группу на новые опросы, пересылает их в личный чат и звонит через Twilio. Управляется через веб-панель — без терминала и редактирования конфигов.

## Что делает

1. Подключается к Telegram через личный аккаунт (userbot на базе gramjs)
2. Отслеживает новые опросы в указанной группе
3. Пересылает опрос в выбранный чат (по умолчанию — «Избранное»)
4. Отправляет текстовое уведомление с вопросом и вариантами ответа
5. Инициирует телефонный звонок через Twilio

## Веб-панель

Встроенная панель управления на `http://localhost:3000`:

- Настройка группы, получателя, номера и кулдауна
- QR-код авторизация Telegram (без ввода кода в терминале)
- Запуск / остановка бота
- Просмотр логов в реальном времени
- Защита паролем

## Требования

- Node.js 18+
- npm
- PM2 (для продакшена): `npm install -g pm2`

## Быстрый старт

```bash
npm install
cp .env.example .env
# Заполните .env (см. ниже)
npm run dev
# Откройте http://localhost:3000
```

## Конфигурация (.env)

Секреты разработчика — заполняются на сервере:

| Переменная | Описание |
|---|---|
| `TG_API_ID` | API ID из [my.telegram.org](https://my.telegram.org) |
| `TG_API_HASH` | API Hash из my.telegram.org |
| `TWILIO_ACCOUNT_SID` | Account SID из [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Auth Token из Twilio |
| `TWILIO_PHONE_NUMBER` | Twilio номер для исходящих звонков |
| `ADMIN_PASSWORD` | Пароль для входа в веб-панель |
| `PORT` | Порт веб-сервера (по умолчанию: 3000) |

Пользовательские настройки (группа, номер, кулдаун) задаются через веб-панель и хранятся в `data/config.json`.

## Деплой через PM2

```bash
npm run build
npm run pm2:start
npm run pm2:logs
```

## Команды

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск в режиме разработки (ts-node) |
| `npm run build` | Компиляция TypeScript |
| `npm start` | Запуск скомпилированного приложения |
| `npm run pm2:start` | Запуск через PM2 |
| `npm run pm2:stop` | Остановка PM2 |
| `npm run pm2:logs` | Просмотр логов PM2 |

## Подробная инструкция

Пошаговая настройка Telegram API, Twilio и деплоя — в [SETUP.md](SETUP.md).
