# Kiến trúc cập nhật hệ thống TON: Telegram - OpenClaw - NotebookLM

Tài liệu này lưu lại phân tích kiến trúc để nâng cấp hệ thống TON từ luồng demo “query NotebookLM” thành một nền tảng public bot có khả năng phục vụ người dùng phổ thông, mở rộng chuẩn câu trả lời, xử lý nhiều người dùng đồng thời và vẫn giữ OpenClaw làm core quản trị.

Ngày ghi: 2026-06-03 UTC

## 1. Định hướng tổng thể

Với yêu cầu mới, kiến trúc nên là **public bot platform**, không chỉ là “query NotebookLM”.

Hệ thống cần hỗ trợ về sau:

- lời chào tự động
- menu hướng dẫn
- chuẩn câu trả lời cho người dân
- phân loại intent
- fallback thân thiện
- giới hạn tải
- hàng đợi khi nhiều user hỏi
- cache
- logging/analytics
- admin monitor qua OpenClaw

## 2. Kiến trúc đề xuất

```text
Telegram
  ↓
Bot Gateway
  ↓
Intent Router
  ↓
Policy / Response Template Layer
  ↓
Knowledge Query Service
  ↓
NotebookLM hiện tại / Gemini RAG tương lai
  ↓
Sanitizer
  ↓
Telegram Reply
```

OpenClaw giữ vai trò core quản lý:

```text
OpenClaw
  ├─ quản lý config/secrets
  ├─ start/restart service
  ├─ xem logs
  ├─ cron warm-up
  ├─ healthcheck
  ├─ admin alerts
  └─ update prompts/templates
```

## 3. Các module nên có

```text
kb-bot/
  src/
    bot/
      telegram.ts              # nhận/gửi Telegram
      commands.ts              # /start, /help
    core/
      intent-router.ts         # phân loại chào hỏi / hỏi tri thức / lỗi / admin
      response-policy.ts       # chuẩn câu trả lời người dân
      templates.ts             # câu chào, fallback, disclaimer
      sanitizer.ts             # chặn log, command, path, token
    knowledge/
      notebooklm-provider.ts   # hiện tại
      gemini-rag-provider.ts   # tương lai
      provider.ts              # interface chung
    queue/
      request-queue.ts         # giới hạn concurrency
      rate-limit.ts            # chống spam
    cache/
      answer-cache.ts          # cache câu hỏi phổ biến
    observability/
      logger.ts
      metrics.ts
      health.ts
    server.ts                  # HTTP health/admin local
    index.ts                   # main
```

## 4. Luồng user mới

Khi user bấm Start:

```text
/start
```

Bot trả:

```text
Xin chào! Tôi là trợ lý tra cứu thông tin từ kho tri thức.
Bạn có thể hỏi các câu như:
- Dự án thực tập là gì?
- Mục tiêu của hệ thống là gì?
- Công nghệ nào được sử dụng?
```

Không gọi NotebookLM ở bước này.

## 5. Luồng hỏi tri thức

Ví dụ user hỏi:

```text
Dự án thực tập của tôi là gì?
```

Bot xử lý:

1. Normalize câu hỏi.
2. Check cache.
3. Nếu cache miss → đưa vào queue.
4. Gọi provider NotebookLM.
5. Sanitize answer.
6. Áp template trả lời.

Ví dụ output mong muốn:

```text
Dự án thực tập là “Xây dựng hệ thống Project Manager Agent và định hướng Multi-Agent tự động hóa vòng đời dự án trên nền tảng OpenClaw”.
```

Không hiện nội dung kỹ thuật như:

```text
nlm ...
/data/workspace/...
OpenClaw...
Authentication expired...
Run nlm login...
```

## 6. Chuẩn câu trả lời cho người dân

Nên có file config để quản lý chuẩn trả lời:

```yaml
tone: "thân thiện, dễ hiểu, ngắn gọn"
max_sentences: 5
no_technical_logs: true
fallback_not_found: "Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?"
backend_error: "Hiện hệ thống chưa truy xuất được dữ liệu. Vui lòng thử lại sau."
greeting: "Xin chào! Tôi có thể giúp bạn tra cứu thông tin từ kho tri thức."
```

Lợi ích:

- Dễ chỉnh style mà không sửa code.
- Tách chuẩn trả lời khỏi logic truy vấn.
- Phù hợp khi cần phục vụ người dân không am hiểu kỹ thuật.

## 7. Xử lý 10–100 user cùng lúc

Không được để mỗi message spawn CLI vô hạn. Cần có queue và giới hạn concurrency.

Thiết lập gợi ý:

```text
maxConcurrentQueries = 3 hoặc 5
maxQueueSize = 100
perUserRateLimit = 1 câu / 3 giây
globalRateLimit = 30 câu / phút
```

Khi hệ thống đông user nhưng vẫn xử lý được:

```text
Yêu cầu của bạn đang được xử lý. Vui lòng chờ trong giây lát.
```

Khi queue đầy:

```text
Hệ thống đang có nhiều người dùng. Vui lòng thử lại sau ít phút.
```

## 8. Per-user lock

Nếu một user gửi 10 câu liên tục, bot không nên xử lý cả 10 câu cùng lúc.

Chính sách đề xuất:

```text
mỗi user chỉ có 1 câu đang xử lý
mỗi user xếp hàng tối đa 2 câu
có thể giữ câu mới nhất và bỏ câu cũ nếu spam
```

Mục tiêu:

- chống spam
- bảo vệ NotebookLM/backend
- tránh user làm nghẽn queue toàn hệ thống

## 9. Cache bắt buộc

Dùng cache theo câu hỏi đã chuẩn hóa.

Ví dụ các câu gần giống:

```text
Dự án thực tập của tôi là gì?
dự án thực tập là gì
đề tài thực tập là gì
```

Giai đoạn đầu:

```text
exact normalized cache TTL 24h
```

Giai đoạn sau:

```text
semantic cache với vector similarity
```

Lợi ích:

- giảm tải NotebookLM
- trả lời nhanh
- bảo vệ backend khi 100 user hỏi câu giống nhau

## 10. Provider abstraction

Không hard-code NotebookLM vào bot.

Tạo interface chung:

```ts
interface KnowledgeProvider {
  query(question: string, options?: QueryOptions): Promise<KnowledgeAnswer>
  healthCheck(): Promise<boolean>
}
```

Ví dụ type:

```ts
type QueryOptions = {
  maxSentences?: number
  language?: "vi" | "en"
  userId?: string
}

type KnowledgeAnswer = {
  answer: string
  sources?: string[]
  confidence?: "high" | "medium" | "low"
  raw?: unknown
}
```

Bot chỉ gọi:

```ts
const result = await provider.query(question)
```

Bot không cần biết provider là:

```text
NotebookLM
Gemini RAG
Local vector DB
Postgres full-text search
```

## 11. NotebookLMProvider hiện tại

```ts
class NotebookLMProvider implements KnowledgeProvider {
  async query(question: string): Promise<KnowledgeAnswer> {
    const raw = await runNotebookLmCli(question)

    return {
      answer: raw.value.answer,
      sources: raw.value.sources_used,
      confidence: "medium",
      raw
    }
  }

  async healthCheck(): Promise<boolean> {
    return checkNotebookLmAuth()
  }
}
```

Ưu điểm:

- dùng được ngay
- tận dụng NotebookLM hiện tại
- phù hợp demo/MVP

Nhược điểm:

- phụ thuộc cookie/session Google
- không phải API production chính thức
- query có thể chậm
- concurrency kém hơn API thật

## 12. GeminiRagProvider tương lai

```ts
class GeminiRagProvider implements KnowledgeProvider {
  async query(question: string): Promise<KnowledgeAnswer> {
    const chunks = await retriever.search(question)
    const answer = await gemini.generate({
      question,
      context: chunks
    })

    return {
      answer,
      sources: chunks.map(c => c.sourceId),
      confidence: "high"
    }
  }

  async healthCheck(): Promise<boolean> {
    return checkGeminiApi()
  }
}
```

Ưu điểm:

- ổn định hơn
- nhanh hơn
- scale tốt hơn
- không phụ thuộc browser cookie
- kiểm soát citation/context tốt hơn

## 13. Bot không đổi khi đổi provider

Config hiện tại:

```yaml
knowledge:
  provider: notebooklm
```

Sau này đổi:

```yaml
knowledge:
  provider: gemini-rag
```

Code bot vẫn giữ:

```ts
const provider = createKnowledgeProvider(config.knowledge.provider)
const answer = await provider.query(question)
```

Factory:

```ts
function createKnowledgeProvider(name: string): KnowledgeProvider {
  if (name === "notebooklm") return new NotebookLMProvider()
  if (name === "gemini-rag") return new GeminiRagProvider()
  throw new Error(`Unknown provider: ${name}`)
}
```

## 14. Vì sao provider abstraction quan trọng?

Nếu hard-code NotebookLM:

```text
Telegram bot → notebooklm CLI trực tiếp
```

Sau này đổi sang Gemini RAG phải sửa nhiều chỗ.

Nếu dùng abstraction:

```text
Telegram bot → KnowledgeProvider → NotebookLM/Gemini
```

Thì chỉ thay provider.

Lợi ích:

- không khóa chết vào NotebookLM
- đổi sang Gemini RAG dễ
- test backend dễ
- mock provider để test bot không cần gọi Google
- scale từng phần
- giữ Telegram UX ổn định dù backend tri thức thay đổi

## 15. Kết nối với chuẩn câu trả lời

Provider chỉ trả dữ liệu lõi:

```json
{
  "answer": "Dự án thực tập là ...",
  "sources": ["Bao_Cao_Thuc_Tap...docx"]
}
```

Response policy mới quyết định trình bày cho người dân:

```text
- câu ngắn
- tiếng Việt
- không kỹ thuật
- không lộ source ID nếu không cần
- fallback nếu không tìm thấy
```

Tách vai trò:

```text
Provider = lấy dữ liệu
Policy = định dạng câu trả lời
Bot = giao tiếp Telegram
```

## 16. Sanitizer layer

Trước khi gửi Telegram, luôn lọc:

- command
- file path
- token-like text
- stack trace
- JSON raw quá dài
- “Authentication expired”
- “Run nlm login”
- OpenClaw internal names

Nếu thấy lỗi kỹ thuật:

```text
Hiện hệ thống chưa truy xuất được dữ liệu. Vui lòng thử lại sau.
```

## 17. Monitoring

Cần log nội bộ, không gửi user.

Log nên có:

```text
request_id
telegram_user_id
question_hash
provider
latency_ms
cache_hit
error_type
```

Health endpoint local:

```text
GET /health
GET /metrics
```

OpenClaw cron check:

```text
mỗi 5 phút gọi /health
nếu lỗi → báo admin
```

## 18. Triển khai khuyến nghị

### Giai đoạn 1 — MVP sạch

```text
Telegram bot service riêng
/start /help
NotebookLM provider
sanitize output
friendly error
queue concurrency 3
cache TTL 24h
logs
```

### Giai đoạn 2 — tối ưu tải

```text
semantic cache
rate limit
admin dashboard/log summary
warm-up cron
```

### Giai đoạn 3 — production

```text
Gemini API + RAG/vector DB
multi-source documents
role-based admin/user
backup/monitoring
```

## 19. Vai trò OpenClaw trong kiến trúc mới

OpenClaw không bị thay thế. OpenClaw chuyển vai trò từ:

```text
chat agent trực tiếp phục vụ public
```

sang:

```text
core quản lý hệ thống, admin, debug, deploy, monitor
```

Cụ thể OpenClaw quản lý:

- cấu hình bot
- secrets/token
- start/stop/restart service
- logs
- healthcheck
- cron warm-up
- memory/dev notes
- deploy/update
- admin commands nội bộ
- fallback/debug khi lỗi

## 20. Kết luận

Hướng đúng:

```text
Public Telegram bot → service riêng
Admin Telegram/OpenClaw → OpenClaw agent
Knowledge provider → NotebookLM hiện tại, Gemini RAG tương lai
```

Thiết kế này xử lý được:

- người dân không thấy kỹ thuật
- thêm câu chào/menu/chuẩn trả lời dễ
- 10–100 user không làm sập backend
- dễ thay NotebookLM bằng RAG khi cần ổn định hơn
- OpenClaw vẫn là core quản lý, không phải public serving layer chính
