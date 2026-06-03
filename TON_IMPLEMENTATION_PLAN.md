# Kế hoạch triển khai hệ thống TON public bot platform

Ngày tạo: 2026-06-03 UTC

## 1. Mục tiêu

Nâng cấp hệ thống TON từ luồng thử nghiệm:

```text
Telegram → OpenClaw agent → NotebookLM → Telegram
```

thành kiến trúc public bot platform:

```text
Telegram user → TON Bot Service → Knowledge Provider → NotebookLM core → Telegram reply
```

OpenClaw vẫn giữ vai trò core quản lý:

```text
OpenClaw → config, secrets, logs, healthcheck, cron warm-up, admin/debug, deploy/restart
```

## 2. Nguyên tắc thiết kế

- Người dân không thấy command, log, path, token, stack trace, lỗi kỹ thuật.
- Bot trả lời tiếng Việt, dễ hiểu, ngắn gọn.
- Có `/start`, `/help`, câu chào, fallback thân thiện.
- Có queue, rate limit, per-user lock để chịu tải 10–100 user.
- Có cache để giảm delay và giảm tải NotebookLM.
- Không hard-code NotebookLM; dùng provider abstraction.
- NotebookLM là core lâu dài; ưu tiên tối ưu NotebookLM thay vì chuyển sang provider khác.
- OpenClaw quản lý hệ thống, không trực tiếp làm public serving layer chính.

## 3. Scope MVP

MVP sẽ có:

```text
- Bot service riêng chạy Node.js
- Telegram long polling hoặc webhook nội bộ
- /start
- /help
- hỏi tri thức qua NotebookLMProvider
- cache normalized question TTL 24h
- queue concurrency 3
- per-user lock
- rate limit cơ bản
- sanitizer output
- friendly error
- health endpoint
- log nội bộ
```

MVP chưa làm:

```text
- semantic cache
- provider dự phòng nếu sau này có yêu cầu mới
- dashboard UI
- multi-document admin upload
- phân quyền phức tạp
```

## 4. Kiến trúc runtime MVP

```text
Telegram
  ↓
TON Bot Service
  ├─ Telegram adapter
  ├─ Command handler (/start, /help)
  ├─ Intent router
  ├─ Rate limiter
  ├─ Queue + per-user lock
  ├─ Cache
  ├─ KnowledgeProvider
  │    └─ NotebookLMProvider
  ├─ Response policy
  ├─ Sanitizer
  └─ Health/metrics endpoint
  ↓
Telegram reply
```

OpenClaw:

```text
OpenClaw
  ├─ start/restart TON Bot Service
  ├─ read logs
  ├─ run healthcheck cron
  ├─ warm-up NotebookLM cron
  ├─ update config/templates
  └─ debug/admin only
```

## 5. Repo/file structure

```text
/data/workspace/ton-bot/
  package.json
  README.md
  .env.example
  config/
    bot.config.json
    templates.vi.json
  src/
    index.ts
    server.ts
    bot/
      telegram.ts
      commands.ts
      message-handler.ts
    core/
      intent-router.ts
      response-policy.ts
      sanitizer.ts
      normalizer.ts
    knowledge/
      provider.ts
      notebooklm-provider.ts
      gemini-rag-provider.ts
      factory.ts
    queue/
      request-queue.ts
      per-user-lock.ts
      rate-limit.ts
    cache/
      answer-cache.ts
    observability/
      logger.ts
      metrics.ts
      health.ts
  logs/
    ton-bot.log
```

## 6. Config dự kiến

```json
{
  "telegram": {
    "tokenFile": "/data/.openclaw/secrets/telegram-bot-token",
    "mode": "polling",
    "allowedUsers": ["*"],
    "adminUsers": ["5168072926"]
  },
  "knowledge": {
    "provider": "notebooklm",
    "notebookId": "4a0c4275-6631-4a1f-aea4-bf5c3e139bb9",
    "queryCommand": "/data/workspace/bin/ask_notebooklm",
    "maxSentences": 5,
    "language": "vi"
  },
  "queue": {
    "maxConcurrentQueries": 3,
    "maxQueueSize": 100,
    "perUserMaxQueued": 2
  },
  "rateLimit": {
    "perUserMinIntervalMs": 3000,
    "globalPerMinute": 30
  },
  "cache": {
    "enabled": true,
    "ttlSeconds": 86400,
    "maxEntries": 1000
  },
  "server": {
    "host": "127.0.0.1",
    "port": 18081
  }
}
```

## 7. Templates tiếng Việt

```json
{
  "start": "Xin chào! Tôi là trợ lý tra cứu thông tin từ kho tri thức. Bạn có thể hỏi các câu như:\n- Dự án thực tập là gì?\n- Mục tiêu của hệ thống là gì?\n- Công nghệ nào được sử dụng?",
  "help": "Bạn hãy nhập câu hỏi bằng tiếng Việt. Tôi sẽ tra cứu trong kho tri thức và trả lời ngắn gọn, dễ hiểu.",
  "notFound": "Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?",
  "backendError": "Hiện hệ thống chưa truy xuất được dữ liệu. Vui lòng thử lại sau.",
  "busy": "Yêu cầu của bạn đang được xử lý. Vui lòng chờ trong giây lát.",
  "queueFull": "Hệ thống đang có nhiều người dùng. Vui lòng thử lại sau ít phút.",
  "rateLimited": "Bạn gửi câu hỏi hơi nhanh. Vui lòng chờ vài giây rồi thử lại."
}
```

## 8. Provider abstraction

Interface:

```ts
export interface KnowledgeProvider {
  query(question: string, options?: QueryOptions): Promise<KnowledgeAnswer>
  healthCheck(): Promise<boolean>
}

export type QueryOptions = {
  maxSentences?: number
  language?: 'vi' | 'en'
  userId?: string
}

export type KnowledgeAnswer = {
  answer: string
  sources?: string[]
  confidence?: 'high' | 'medium' | 'low'
  raw?: unknown
}
```

NotebookLMProvider hiện tại:

```text
- gọi /data/workspace/bin/ask_notebooklm
- parse JSON
- lấy value.answer
- lấy value.sources_used
- trả KnowledgeAnswer
```

FallbackProvider tương lai:

```text
- nhận question
- retrieve chunks từ vector DB
- gọi Gemini Flash/Pro
- trả answer + citations
```

## 9. Queue và chống quá tải

Chính sách:

```text
maxConcurrentQueries = 3
maxQueueSize = 100
perUserMaxQueued = 2
perUserMinIntervalMs = 3000
globalPerMinute = 30
```

Luồng:

```text
message đến
→ check command
→ check rate limit
→ normalize question
→ cache lookup
→ if hit: reply ngay
→ if miss: enqueue
→ provider.query
→ sanitize
→ cache set
→ reply
```

Nếu user spam:

```text
Bạn gửi câu hỏi hơi nhanh. Vui lòng chờ vài giây rồi thử lại.
```

Nếu queue đầy:

```text
Hệ thống đang có nhiều người dùng. Vui lòng thử lại sau ít phút.
```

## 10. Cache

Normalize question:

```text
- lowercase
- trim spaces
- remove repeated punctuation
- normalize Vietnamese unicode
- remove polite filler nếu cần
```

Key:

```text
sha256(normalizedQuestion)
```

Value:

```json
{
  "answer": "...",
  "sources": ["..."],
  "createdAt": 1780450000,
  "ttlSeconds": 86400
}
```

## 11. Sanitizer

Chặn trước khi gửi Telegram:

```text
- /data/workspace/...
- /root/...
- openclaw ...
- nlm ...
- Authentication expired
- Run 'nlm login'
- token-like strings
- stack trace
- raw JSON quá dài
```

Nếu phát hiện lỗi kỹ thuật:

```text
Hiện hệ thống chưa truy xuất được dữ liệu. Vui lòng thử lại sau.
```

## 12. Healthcheck

Endpoint local:

```text
GET http://127.0.0.1:18081/health
```

Response:

```json
{
  "status": "ok",
  "telegram": "ok",
  "provider": "ok",
  "cacheEntries": 10,
  "queueDepth": 0,
  "uptimeSeconds": 3600
}
```

Metrics endpoint:

```text
GET http://127.0.0.1:18081/metrics
```

Theo dõi:

```text
requests_total
cache_hits_total
provider_errors_total
avg_latency_ms
queue_depth
active_queries
```

## 13. OpenClaw integration

OpenClaw sẽ dùng để:

```text
- tạo/sửa code
- chạy service
- kiểm tra logs
- setup cron healthcheck
- setup cron warm-up
- báo admin khi lỗi
```

Cron healthcheck gợi ý:

```text
mỗi 5 phút gọi /health
nếu status != ok → báo admin
```

Warm-up gợi ý:

```text
mỗi 10–15 phút query câu nhẹ vào NotebookLM
mục tiêu: giảm cold start và phát hiện auth expired sớm
```

## 14. Migration Telegram từ OpenClaw channel sang bot service riêng

Hiện Telegram token đang dùng bởi OpenClaw channel.

Để tránh 2 process cùng poll một bot token, cần chọn một trong hai hướng:

### Hướng A: Bot service dùng token chính, OpenClaw Telegram channel tắt

```text
channels.telegram.enabled = false
```

Ưu điểm:

```text
- public bot sạch
- không lẫn OpenClaw agent
- ít rủi ro lộ command/log
```

Nhược:

```text
- admin không chat trực tiếp với OpenClaw qua cùng bot token
```

### Hướng B: Tạo bot Telegram thứ hai cho public service

```text
Bot 1: OpenClaw admin/internal
Bot 2: TON public knowledge bot
```

Ưu điểm:

```text
- tách public và admin rõ nhất
- OpenClaw vẫn chat admin qua Telegram riêng
- public bot không có OpenClaw tool exposure
```

Nhược:

```text
- cần thêm bot token
```

Khuyến nghị: **Hướng B** cho production. Hướng A dùng nếu muốn nhanh và chấp nhận OpenClaw Telegram channel tạm tắt.

## 15. Lộ trình triển khai

### Phase 0 — chuẩn bị

- Chốt dùng token hiện tại hay tạo bot Telegram public mới.
- Chốt NotebookLM notebook phục vụ public.
- Chốt text `/start`, `/help`, fallback.
- Chốt concurrency ban đầu.

### Phase 1 — MVP service riêng

- Tạo `/data/workspace/ton-bot`.
- Setup Node/TypeScript.
- Implement Telegram polling.
- Implement `/start`, `/help`.
- Implement NotebookLMProvider.
- Implement sanitizer.
- Implement cache TTL.
- Implement queue concurrency 3.
- Implement rate limit.
- Implement health endpoint.
- Test local với admin user.

### Phase 2 — OpenClaw quản lý service

- Tạo script start/restart.
- Tạo log file.
- Tạo healthcheck cron.
- Tạo warm-up cron.
- Tạo admin alert nếu provider auth lỗi.

### Phase 3 — public hardening

- Tách public token nếu chưa tách.
- Giới hạn nội dung lỗi kỹ thuật.
- Thêm per-user lock.
- Thêm metrics.
- Load test giả lập 10–100 câu hỏi.
- Điều chỉnh concurrency/cache/rate limit.

### Phase 4 — Tối ưu NotebookLM lâu dài

Mục tiêu Phase 4 không phải chuyển sang Gemini RAG. NotebookLM tiếp tục là core tri thức lâu dài.

Các việc cần làm:

- Giữ NotebookLM là provider chính.
- Tối ưu latency câu hỏi chưa có cache.
- Giảm overhead gọi CLI bằng worker/daemon local nếu khả thi.
- Duy trì phiên NotebookLM bằng warm-up cron.
- Tối ưu prompt truy vấn ngắn, rõ notebook, giới hạn số câu trả lời.
- Tăng cache hit bằng exact cache + synonym map + semantic-like cache nội bộ.
- Tạo bộ câu hỏi thường gặp để prefetch/cache trước.
- Theo dõi latency P50/P95 để điều chỉnh concurrency và queue.
- Cảnh báo sớm khi auth NotebookLM hết hạn.

Gemini RAG chỉ là phương án dự phòng nghiên cứu, không nằm trong lộ trình chính hiện tại.

## 16. Quyết định cần người dùng duyệt

Trước khi code MVP, cần chốt:

1. Dùng Telegram bot token hiện tại hay tạo bot mới cho public?
2. Có tắt OpenClaw Telegram channel khi bot service riêng chạy không?
3. Public bot cho phép mọi user hay chỉ allowlist giai đoạn test?
4. Text chính thức cho `/start`, `/help`, fallback là gì?
5. NotebookLM notebook nào dùng làm nguồn public chính?

## 17. Khuyến nghị quyết định ban đầu

Khuyến nghị cho an toàn:

```text
- Tạo bot Telegram thứ hai cho public TON bot.
- Giữ bot hiện tại cho OpenClaw admin/internal.
- Public bot giai đoạn đầu allowlist admin user trước.
- Sau test ổn mới mở rộng cho người dân.
- Provider core lâu dài: NotebookLM.
- Concurrency ban đầu: 3.
- Cache TTL: 24h.
- Tối ưu NotebookLM là hướng chính, không chuyển Gemini RAG nếu chưa có yêu cầu mới.
```

## 18. Quyết định đã được duyệt

Ngày duyệt: 2026-06-03 03:13 UTC

User đã đồng ý với khuyến nghị:

```text
- Tạo bot Telegram thứ hai cho public TON bot.
- Giữ bot hiện tại cho OpenClaw admin/internal.
- Public bot giai đoạn đầu allowlist user/admin trước.
- Provider core lâu dài: NotebookLM.
- Concurrency ban đầu: 3.
- Cache TTL: 24h.
- Tối ưu NotebookLM là hướng chính, không chuyển Gemini RAG nếu chưa có yêu cầu mới.
```

Bước tiếp theo cần token cho bot Telegram thứ hai để triển khai MVP.

## 18. Tối ưu latency khi vẫn dùng NotebookLM

Hiện câu hỏi chưa có cache có thể mất khoảng 10 giây do các lớp sau:

```text
Telegram polling → bot handler → spawn CLI nlm → NotebookLM xử lý → parse JSON → Telegram reply
```

Mục tiêu tối ưu:

```text
cache hit: < 1 giây
cache miss P50: 4–7 giây nếu NotebookLM phản hồi tốt
cache miss P95: theo dõi thực tế, tránh vượt 15–20 giây
```

Hướng tối ưu theo thứ tự ưu tiên:

1. **Cache mạnh hơn**
   - exact normalized cache TTL 24h
   - synonym map cho câu phổ biến
   - prefetch câu hỏi hay gặp khi service start

2. **Warm-up NotebookLM**
   - cron/query nhẹ mỗi 10–15 phút
   - phát hiện auth expired sớm
   - giảm cold start

3. **Giảm overhead CLI**
   - hiện mỗi query spawn `nlm` process mới
   - nghiên cứu daemon/worker giữ runtime ấm
   - nếu CLI không hỗ trợ daemon ổn định, giữ CLI nhưng dùng cache/prefetch để giảm số lần gọi

4. **Routing notebook chính xác**
   - chọn đúng notebook trước khi gọi NotebookLM
   - tránh hỏi sai notebook gây trả lời sai hoặc phải hỏi lại

5. **Prompt ngắn và ổn định**
   - thêm “Trả lời ngắn, tối đa 5 câu”
   - tránh prompt dài làm NotebookLM xử lý lâu

6. **Queue + concurrency hợp lý**
   - concurrency ban đầu 3
   - nếu NotebookLM chậm hoặc giới hạn, giảm xuống 2
   - nếu ổn định, thử tăng 4–5 sau load test

7. **Metrics latency**
   - ghi `latencyMs` theo từng query
   - theo dõi cache hit/miss
   - tính P50/P95 để biết tối ưu có hiệu quả không

## 18. Tiêu chí hoàn thành MVP

MVP đạt khi:

- User gửi `/start` nhận câu chào đúng.
- User gửi `/help` nhận hướng dẫn đúng.
- User hỏi tri thức nhận answer từ NotebookLM.
- Không hiện command/path/log kỹ thuật.
- Cache hit trả nhanh hơn query đầu.
- 5–10 câu hỏi đồng thời không làm service crash.
- `/health` trả `status: ok`.
- OpenClaw đọc được logs và kiểm tra health.
