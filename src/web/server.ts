import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { getEnvSecrets, loadConfig, saveConfig, getConfig } from '../config-manager';
import { startBot, stopBot, getBotStatus, startQrAuth, checkTgAuthorized } from '../bot';

const app = express();
app.use(express.json());

// Auth tokens (in-memory)
const validTokens = new Set<string>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !validTokens.has(token)) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  next();
}

// Serve HTML panel
app.get('/', (_req, res) => {
  const htmlPath = path.join(__dirname, 'index.html');
  // In development (ts-node), look in src/web/; in production (compiled), look in dist/web/
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    const srcHtmlPath = path.join(process.cwd(), 'src', 'web', 'index.html');
    res.sendFile(srcHtmlPath);
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const secrets = getEnvSecrets();

  if (password === secrets.adminPassword) {
    const token = generateToken();
    validTokens.add(token);
    logger.info('Успешный вход в панель управления');
    res.json({ token });
  } else {
    logger.warn('Неудачная попытка входа');
    res.status(403).json({ error: 'Неверный пароль' });
  }
});

// Status
app.get('/api/status', requireAuth, async (_req, res) => {
  try {
    const botStatus = getBotStatus();
    const config = getConfig();
    const tgAuthorized = await checkTgAuthorized();

    res.json({
      bot: botStatus,
      config,
      tgAuthorized,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Save config
app.post('/api/config', requireAuth, (req, res) => {
  try {
    const { sourceGroup, destinationChat, callPhoneNumber, callCooldownSeconds } = req.body;

    const updated = saveConfig({
      sourceGroup: sourceGroup || '',
      destinationChat: destinationChat || 'me',
      callPhoneNumber: callPhoneNumber || '',
      callCooldownSeconds: Number(callCooldownSeconds) || 60,
    });

    res.json({ success: true, config: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// QR code auth
let latestQrCode: string | null = null;
let qrAuthInProgress = false;
let qrTimestamp: number = 0;

app.get('/api/qr', requireAuth, async (_req, res) => {
  try {
    if (qrAuthInProgress) {
      // Return latest QR code if auth is already in progress
      if (latestQrCode) {
        res.json({ qrCode: latestQrCode, status: 'waiting', qrTimestamp });
      } else {
        res.json({ qrCode: null, status: 'generating', qrTimestamp });
      }
      return;
    }

    qrAuthInProgress = true;
    latestQrCode = null;

    // Start QR auth in background
    startQrAuth((qrBase64) => {
      latestQrCode = qrBase64;
      qrTimestamp = Date.now();
    }).then((success) => {
      qrAuthInProgress = false;
      if (success) {
        logger.info('QR авторизация успешна');
        latestQrCode = null;
      }
    }).catch((err) => {
      qrAuthInProgress = false;
      latestQrCode = null;
      logger.error(`QR авторизация ошибка: ${err.message}`);
    });

    // Wait a bit for the first QR code to be generated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (latestQrCode) {
      res.json({ qrCode: latestQrCode, status: 'waiting', qrTimestamp });
    } else {
      res.json({ qrCode: null, status: 'generating', qrTimestamp });
    }
  } catch (error) {
    qrAuthInProgress = false;
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Check QR auth status
app.get('/api/qr/status', requireAuth, async (_req, res) => {
  try {
    const tgAuthorized = await checkTgAuthorized();
    res.json({
      authorized: tgAuthorized,
      qrCode: latestQrCode,
      inProgress: qrAuthInProgress,
      qrTimestamp,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Start bot
app.post('/api/bot/start', requireAuth, async (_req, res) => {
  try {
    await startBot();
    res.json({ success: true, status: getBotStatus() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Stop bot
app.post('/api/bot/stop', requireAuth, async (_req, res) => {
  try {
    await stopBot();
    res.json({ success: true, status: getBotStatus() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

// Logs
app.get('/api/logs', requireAuth, (_req, res) => {
  try {
    const logFile = path.join(process.cwd(), 'logs', 'app.log');
    if (!fs.existsSync(logFile)) {
      res.json({ logs: [] });
      return;
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    const lastLines = lines.slice(-50);
    res.json({ logs: lastLines });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: msg });
  }
});

export function startWebServer(port: number): void {
  loadConfig();

  app.listen(port, () => {
    logger.info(`Веб-панель запущена на http://localhost:${port}`);
  });
}
