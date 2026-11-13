export default {
  name: 'basic',
  commands: ['ping', 'help'],
  description: 'Basic bot commands',
  async execute({ sock, message, commandName }) {
    const jid = message.key.remoteJid;

    if (commandName === 'ping') {
      await sock.sendMessage(jid, { text: 'Pong! البوت خدام.' }, { quoted: message });
      return;
    }

    await sock.sendMessage(jid, {
      text: 'الأوامر المتاحة:\n!ping — اختبار حالة البوت\n!help — عرض المساعدة'
    }, { quoted: message });
  }
};
