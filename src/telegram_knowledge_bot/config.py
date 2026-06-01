from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    gemini_api_key: str
    gemini_model: str
    bot_mode: str
    webhook_url: str | None
    webhook_port: int
    knowledge_dir: str
    max_context_chars: int


def load_settings() -> Settings:
    load_dotenv()
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not token:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN in .env")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY in .env")
    return Settings(
        telegram_bot_token=token,
        gemini_api_key=key,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip(),
        bot_mode=os.getenv("BOT_MODE", "polling").strip().lower(),
        webhook_url=os.getenv("WEBHOOK_URL", "").strip() or None,
        webhook_port=int(os.getenv("WEBHOOK_PORT", "8080")),
        knowledge_dir=os.getenv("KNOWLEDGE_DIR", "data/docs").strip(),
        max_context_chars=int(os.getenv("MAX_CONTEXT_CHARS", "14000")),
    )
