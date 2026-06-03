export class TelegramBot {
  constructor(token, logger) {
    this.token = token;
    this.logger = logger;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.offset = 0;
    this.running = false;
  }

  async api(method, body = {}) {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram API ${method} failed`);
    return data.result;
  }

  async deleteWebhook() {
    return this.api('deleteWebhook', { drop_pending_updates: false });
  }

  async sendMessage(chatId, text, extra = {}) {
    const safe = String(text || '').slice(0, 3900);
    return this.api('sendMessage', { chat_id: chatId, text: safe, disable_web_page_preview: true, ...extra });
  }

  async sendChatAction(chatId, action = 'typing') {
    try { await this.api('sendChatAction', { chat_id: chatId, action }); } catch {}
  }

  async getUpdates() {
    return this.api('getUpdates', { offset: this.offset, timeout: 25, allowed_updates: ['message'] });
  }

  async poll(onUpdate) {
    this.running = true;
    this.logger.info('telegram_polling_started', {});
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          await onUpdate(update);
        }
      } catch (err) {
        this.logger.error('telegram_poll_error', { error: err.message });
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}
