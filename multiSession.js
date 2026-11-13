import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { handleIncomingMessage } from './messageHandler.js';
import { log } from '../utils/logger.js';

const activeSessions = new Map();
const reconnectTimers = new Map();

export async function startSession(sessionName, context) {
  if (activeSessions.has(sessionName)) {
    log.warn({ sessionName }, 'Session already running; skipping duplicate');
    return activeSessions.get(sessionName);
  }

  const sessionDir = path.resolve('sessions', sessionName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  await mkdir(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: context.config.printQRInTerminal !== false,
    markOnlineOnConnect: context.config.markOnlineOnConnect === true,
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' })
  });

  activeSessions.set(sessionName, sock);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      log.info({ sessionName }, 'WhatsApp session connected');
      const timer = reconnectTimers.get(sessionName);
      if (timer) clearTimeout(timer);
      reconnectTimers.delete(sessionName);
    }

    if (connection === 'close') {
      activeSessions.delete(sessionName);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      log.warn({ sessionName, statusCode, loggedOut }, 'WhatsApp connection closed');

      if (!loggedOut) {
        const delay = Number(context.config.reconnectDelayMs) || 5000;
        if (!reconnectTimers.has(sessionName)) {
          const timer = setTimeout(() => {
            reconnectTimers.delete(sessionName);
            startSession(sessionName, context).catch((error) =>
              log.error({ sessionName, err: error }, 'Reconnect failed')
            );
          }, delay);
          reconnectTimers.set(sessionName, timer);
        }
      } else {
        log.error({ sessionName }, 'Session logged out. Remove/re-pair only if you intend to log in again.');
      }
    }
  });

  sock.ev.on('group-participants.update', async (event) => {
    for (const plugin of context.plugins) {
      if (typeof plugin.onParticipantsUpdate !== 'function') continue;
      try {
        await plugin.onParticipantsUpdate({ sock, event, sessionName });
      } catch (error) {
        log.error({ sessionName, plugin: plugin.name, err: error }, 'Participant event plugin failed');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      try {
        await handleIncomingMessage(sock, message, {
          ...context,
          sessionName
        });
      } catch (error) {
        log.error({ sessionName, err: error }, 'Message handler failed');
      }
    }
  });

  return sock;
}

export function getActiveSessions() {
  return new Map(activeSessions);
}
