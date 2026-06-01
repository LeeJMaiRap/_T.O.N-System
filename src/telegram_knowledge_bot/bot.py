from __future__ import annotations

import asyncio
import logging
from html import escape

from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from .config import Settings, load_settings
from .gemini_client import GeminiAnswerer
from .knowledge import KnowledgeBase

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger(__name__)


class KnowledgeBot:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.kb = KnowledgeBase(settings.knowledge_dir)
        self.ai = GeminiAnswerer(settings.gemini_api_key, settings.gemini_model)

    def build_app(self) -> Application:
        self.kb.load()
        app = Application.builder().token(self.settings.telegram_bot_token).build()
        app.add_handler(CommandHandler("start", self.start))
        app.add_handler(CommandHandler("help", self.help))
        app.add_handler(CommandHandler("reload", self.reload))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.on_message))
        app.add_error_handler(self.on_error)
        return app

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(
            "Chào. Gửi câu hỏi, tôi trả lời dựa trên tài liệu đã nạp trong data/docs.\n"
            "Lệnh: /reload để nạp lại tài liệu, /help để xem hướng dẫn."
        )

    async def help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(
            "Cách dùng:\n"
            "1. Đặt file .txt, .md, .pdf vào data/docs.\n"
            "2. Chạy /reload nếu vừa thêm tài liệu.\n"
            "3. Gửi câu hỏi. Bot chỉ trả lời theo tài liệu."
        )

    async def reload(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        self.kb.load()
        await update.message.reply_text(f"Đã nạp {len(self.kb.chunks)} đoạn tri thức.")

    async def on_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        question = (update.message.text or "").strip()
        if not question:
            return
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
        ctx, sources = self.kb.build_context(question, self.settings.max_context_chars)
        answer = await self.ai.answer(question, ctx, sources)
        await update.message.reply_text(escape(answer), parse_mode=ParseMode.HTML, disable_web_page_preview=True)

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        log.exception("Telegram handler error", exc_info=context.error)
        if isinstance(update, Update) and update.effective_message:
            await update.effective_message.reply_text("Lỗi xử lý. Kiểm tra log server.")


def main() -> None:
    settings = load_settings()
    bot = KnowledgeBot(settings)
    app = bot.build_app()
    if settings.bot_mode == "webhook":
        if not settings.webhook_url:
            raise RuntimeError("BOT_MODE=webhook requires WEBHOOK_URL")
        app.run_webhook(
            listen="0.0.0.0",
            port=settings.webhook_port,
            webhook_url=settings.webhook_url,
        )
    else:
        app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
