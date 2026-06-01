# Telegram Knowledge Bot: Gemini RAG thay NotebookLM

## Kết luận nghiên cứu

NotebookLM hiện không có API chính thức ổn định cho bot backend. Có vài thư viện không chính thức, nhưng phụ thuộc web/session Google, dễ vỡ, rủi ro bảo mật.

Giải pháp dùng trong repo này:

- Telegram Bot nhận câu hỏi.
- Local RAG đọc tài liệu `.txt`, `.md`, `.pdf` trong `data/docs`.
- TF-IDF retrieval chọn đoạn liên quan.
- Gemini API sinh câu trả lời, bị ràng buộc chỉ trả lời theo context.
- `.env` giữ token/API key.

Có thể nâng cấp sau:

- Thay TF-IDF bằng embeddings + Chroma/FAISS/pgvector.
- Dùng Gemini File API cho PDF lớn/tài liệu tái sử dụng nhiều lần.
- Dùng webhook khi deploy production.

## Kiến trúc

```text
Telegram user
  -> Telegram Bot API
  -> python-telegram-bot handler
  -> KnowledgeBase search(data/docs)
  -> Gemini API with grounded context
  -> Telegram reply
```

## Cấu trúc

```text
.
├── .env.example
├── requirements.txt
├── README.md
├── data/docs/sample.md
└── src/telegram_knowledge_bot/
    ├── __main__.py
    ├── bot.py
    ├── config.py
    ├── gemini_client.py
    └── knowledge.py
```

## Cài đặt

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Sửa `.env`:

```env
TELEGRAM_BOT_TOKEN=token-tu-BotFather
GEMINI_API_KEY=key-tu-Google-AI-Studio
GEMINI_MODEL=gemini-2.5-flash
BOT_MODE=polling
KNOWLEDGE_DIR=data/docs
MAX_CONTEXT_CHARS=14000
```

## Thêm tài liệu

Đặt file vào:

```text
data/docs/
```

Hỗ trợ:

- `.txt`
- `.md`
- `.pdf`

Ví dụ đã có `data/docs/sample.md`.

## Chạy polling local

```bash
PYTHONPATH=src python -m telegram_knowledge_bot
```

Trên Telegram:

- `/start` kiểm tra bot sống.
- `/reload` nạp lại tài liệu sau khi thêm/sửa file.
- Gửi câu hỏi.

## Chạy webhook production

`.env`:

```env
BOT_MODE=webhook
WEBHOOK_URL=https://your-domain.com/telegram-webhook
WEBHOOK_PORT=8080
```

Chạy:

```bash
PYTHONPATH=src python -m telegram_knowledge_bot
```

Cần reverse proxy HTTPS trỏ vào port `WEBHOOK_PORT`.

## Nguyên tắc chống trả lời lan man

`gemini_client.py` đặt system prompt:

- Chỉ trả lời dựa trên `CONTEXT`.
- Không thấy thông tin thì trả lời: `Tôi không tìm thấy thông tin này trong tài liệu đã nạp.`
- Nhiệt độ thấp `temperature=0.1`.
- Context lấy từ retrieval, không lấy toàn internet.

## Test nhanh retrieval không cần token

```bash
PYTHONPATH=src python - <<'PY'
from telegram_knowledge_bot.knowledge import KnowledgeBase
kb = KnowledgeBase('data/docs')
kb.load()
ctx, sources = kb.build_context('bot trả lời dựa trên đâu?', 4000)
print(sources)
print(ctx[:800])
PY
```

## Ghi chú bảo mật

- Không commit `.env`.
- Không dùng thư viện NotebookLM không chính thức cho production nếu chưa audit.
- Token Telegram và Gemini API key nên rotate nếu lộ.
