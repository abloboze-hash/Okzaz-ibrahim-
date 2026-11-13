import { log } from '../utils/logger.js';

function getText(message) {
  const content = message.message;
  if (!content) return '';
  return content.conversation
    || content.extendedTextMessage?.text
    || content.imageMessage?.caption
    || content.videoMessage?.caption
    || '';
}

export async function handleIncomingMessage(sock, message, context) {
  if (!message?.message || message.key?.fromMe) return;
  const text = getText(message).trim();
  const prefix = context.config.prefix || '!';
  if (!text.startsWith(prefix)) return;

  const [rawName, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  if (!rawName) return;
  const commandName = rawName.toLowerCase();
  const command = context.plugins.find((plugin) =>
    Array.isArray(plugin.commands) && plugin.commands.includes(commandName)
  );
  if (!command) return;

  const permissions = await import('../utils/jsonStore.js').then((m) =>
    m.readJson('./database/permissions.json', { owners: [], admins: [] })
  );
  const senderJid = message.key.participant || message.key.remoteJid || '';
  const sender = senderJid.split('@')[0];
  const isOwner = (permissions.owners || []).includes(sender);
  const isAdmin = isOwner || (permissions.admins || []).includes(sender);
  const jid = message.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  let groupAdmin = false;
  let botAdmin = false;
  let metadata = null;

  if (isGroup && (command.groupAdminOnly || command.botAdminRequired)) {
    metadata = await sock.groupMetadata(jid);
    const participants = metadata.participants || [];
    const senderInfo = participants.find((p) => p.id === senderJid);
    const botInfo = participants.find((p) => p.id === sock.user?.id || p.id?.split(':')[0] === sock.user?.id?.split(':')[0]);
    groupAdmin = Boolean(senderInfo?.admin || senderInfo?.isAdmin || isOwner || isAdmin);
    botAdmin = Boolean(botInfo?.admin || botInfo?.isAdmin);
  }

  if (command.groupOnly && !isGroup) {
    await sock.sendMessage(jid, { text: 'هذا الأمر متاح داخل المجموعات فقط.' }, { quoted: message });
    return;
  }
  if (command.ownerOnly && !isOwner) {
    await sock.sendMessage(jid, { text: 'هذا الأمر مخصص لمالك البوت.' }, { quoted: message });
    return;
  }
  if (command.adminOnly && !isAdmin) {
    await sock.sendMessage(jid, { text: 'ليست لديك صلاحية استعمال هذا الأمر.' }, { quoted: message });
    return;
  }
  if (command.groupAdminOnly && !groupAdmin) {
    await sock.sendMessage(jid, { text: 'هذا الأمر مخصص لمشرفي المجموعة.' }, { quoted: message });
    return;
  }
  if ((command.botAdminRequired || commandName === 'kick' || commandName === 'link') && !botAdmin) {
    await sock.sendMessage(jid, { text: 'خاص البوت يكون مشرفاً في المجموعة لتنفيذ هذا الأمر.' }, { quoted: message });
    return;
  }

  log.info({ command: commandName, sender, session: context.sessionName }, 'Command received');
  await command.execute({
    sock, message, args, commandName, sessionName: context.sessionName,
    isOwner, isAdmin, isGroup, groupAdmin, botAdmin, metadata
  });
}
