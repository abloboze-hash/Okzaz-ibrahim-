import { readJson, writeJson } from '../utils/jsonStore.js';

function getMentionedJids(message) {
  const context = message.message?.extendedTextMessage?.contextInfo;
  const mentioned = context?.mentionedJid || [];
  if (mentioned.length) return mentioned;
  const quoted = context?.participant;
  return quoted ? [quoted] : [];
}

export default {
  name: 'group-tools',
  commands: ['tagall', 'admins', 'groupinfo', 'link', 'kick', 'welcome'],
  description: 'Group administration commands',
  groupAdminOnly: true,
  botAdminRequired: false,

  async execute({ sock, message, args, commandName, isGroup, metadata }) {
    const jid = message.key.remoteJid;

    if (commandName === 'tagall') {
      if (!isGroup) return;
      const members = metadata?.participants || await sock.groupMetadata(jid).then(m => m.participants);
      const mentions = members.map(p => p.id);
      const lines = members.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`);
      await sock.sendMessage(jid, {
        text: `📢 تنبيه لجميع أعضاء المجموعة\n${args.join(' ') ? `\n${args.join(' ')}\n` : ''}\n${lines.join('\n')}`,
        mentions
      }, { quoted: message });
      return;
    }

    if (commandName === 'admins') {
      const members = metadata?.participants || (await sock.groupMetadata(jid)).participants;
      const admins = members.filter(p => p.admin || p.isAdmin);
      await sock.sendMessage(jid, {
        text: `👮 مشرفو المجموعة:\n${admins.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n') || 'لا يوجد مشرفون.'}`,
        mentions: admins.map(p => p.id)
      }, { quoted: message });
      return;
    }

    if (commandName === 'groupinfo') {
      const info = metadata || await sock.groupMetadata(jid);
      await sock.sendMessage(jid, {
        text: `📋 معلومات المجموعة\nالاسم: ${info.subject}\nعدد الأعضاء: ${info.participants?.length || 0}\nالوصف: ${info.desc || 'غير محدد'}`
      }, { quoted: message });
      return;
    }

    if (commandName === 'link') {
      const invite = await sock.groupInviteCode(jid);
      await sock.sendMessage(jid, { text: `🔗 رابط دعوة المجموعة:\nhttps://chat.whatsapp.com/${invite}` }, { quoted: message });
      return;
    }

    if (commandName === 'kick') {
      const targets = getMentionedJids(message);
      if (!targets.length) {
        await sock.sendMessage(jid, { text: 'استعمل الأمر مع منشن العضو: !kick @العضو' }, { quoted: message });
        return;
      }
      await sock.groupParticipantsUpdate(jid, targets, 'remove');
      await sock.sendMessage(jid, { text: `تم إرسال طلب إزالة ${targets.length} عضو/أعضاء.` }, { quoted: message });
      return;
    }

    if (commandName === 'welcome') {
      const file = './database/groups.json';
      const data = await readJson(file, { groups: {} });
      const value = (args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(value)) {
        await sock.sendMessage(jid, { text: `الترحيب حالياً: ${data.groups[jid]?.welcome ? 'مفعّل' : 'متوقف'}\nاستعمل: !welcome on أو !welcome off` }, { quoted: message });
        return;
      }
      data.groups[jid] = { ...(data.groups[jid] || {}), welcome: value === 'on' };
      await writeJson(file, data);
      await sock.sendMessage(jid, { text: value === 'on' ? 'تم تفعيل الترحيب.' : 'تم إيقاف الترحيب.' }, { quoted: message });
    }
  },

  async onParticipantsUpdate({ sock, event }) {
    if (event.action !== 'add' && event.action !== 'remove') return;
    const data = await readJson('./database/groups.json', { groups: {} });
    const settings = data.groups[event.id];
    if (!settings?.welcome) return;
    if (event.action === 'add') {
      for (const member of event.participants || []) {
        await sock.sendMessage(event.id, {
          text: `أهلاً وسهلاً @${member.split('@')[0]} في المجموعة! 👋`,
          mentions: [member]
        });
      }
    }
  }
};
