# TON Public Bot

Public Telegram knowledge bot for TON.

## Start

```bash
cd /data/workspace/ton-bot
npm start
```

## Health

```bash
curl http://127.0.0.1:18081/health
```

## Config

- Config: `config/bot.config.json`
- Templates: `config/templates.vi.json`
- Token file: `/data/.openclaw/secrets/ton-public-telegram-bot-token`

## Current decisions

- Public bot username: `@kho_tri_thuc_toan_dan_bot`
- Allowlist initial user: `5168072926`
- Provider: NotebookLM
- Concurrency: 3
- Cache TTL: 24h
