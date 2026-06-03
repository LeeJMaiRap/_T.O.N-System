# TON current implementation status

Ngày cập nhật: 2026-06-03 UTC

## Trạng thái hiện tại

Hệ thống TON public bot đã đi qua giai đoạn lập kế hoạch và đã có MVP đang chạy.

## Quyết định đã chốt

- Dùng bot Telegram thứ hai cho public TON bot.
- Giữ bot Telegram hiện tại cho OpenClaw admin/internal.
- Public bot giai đoạn đầu allowlist admin/user trước.
- NotebookLM là core tri thức lâu dài.
- Concurrency ban đầu: 3.
- Cache TTL: 24 giờ.

## Bot public

Bot public đang dùng:

```text
@kho_tri_thuc_toan_dan_bot
```

Bot public đã trả lời được câu hỏi từ NotebookLM.

## NotebookLM

Notebook chính cho hệ thống TON:

```text
027c86d0-5902-4980-8b6b-ce95738c95e1
Kho tri thức cài đặt Telegram - OpenClaw - NotebookLM
```

Notebook báo cáo thực tập:

```text
4a0c4275-6631-4a1f-aea4-bf5c3e139bb9
Autonomous AI Project Management: OpenClaw and Multi-Agent Systems Development
```

Bot có routing nhiều notebook:

- Câu hỏi liên quan TON, workflow, public bot, OpenClaw, Telegram, NotebookLM, kế hoạch, cache, queue, concurrency → notebook TON.
- Câu hỏi liên quan thực tập, báo cáo, dự án, PMBOK, Agile, Scrum → notebook báo cáo thực tập.

## Code đã triển khai

Service nằm tại:

```text
/data/workspace/ton-bot
```

Đã có:

- Telegram polling service riêng.
- Allowlist user/admin.
- `/start` và `/help`.
- NotebookLMProvider.
- Routing nhiều notebook.
- Sanitizer chặn lỗi kỹ thuật.
- Queue concurrency 3.
- Rate limit cơ bản.
- Cache TTL 24h.
- Persistent cache file.
- Prefetch questions.
- Startup warm-up.
- Warm-up endpoint.
- Metrics endpoint.
- Cron warm-up mỗi 15 phút.

## Endpoint nội bộ

Health:

```text
GET http://127.0.0.1:18081/health
```

Metrics:

```text
GET http://127.0.0.1:18081/metrics
```

Warm-up:

```text
GET http://127.0.0.1:18081/warmup
```

## Cache và tốc độ

Câu hỏi đã có cache trả lời nhanh hơn rõ rệt.

Câu hỏi chưa có cache vẫn có thể mất khoảng 10–16 giây do NotebookLM và CLI path.

Đã thêm warm-up/prefetch để tăng khả năng cache hit.

## Commit GitHub

Các commit quan trọng:

```text
7ee7c2c Add TON public bot MVP
84d9a43 Update TON plan to keep NotebookLM core
94eca7d Add TON NotebookLM warmup and metrics
```

## Trạng thái phase

Không còn đúng nếu nói hệ thống mới chỉ chuẩn bị hoặc cần token bot thứ hai.

Trạng thái đúng hiện tại:

```text
Phase 0: hoàn thành
Phase 1: MVP service riêng đã triển khai và đang test
Phase 2: đã bắt đầu tích hợp OpenClaw quản lý qua health/warm-up cron
Phase 3: chưa thực hiện đầy đủ load test và hardening public
Phase 4: chưa tối ưu sâu NotebookLM daemon/worker; mới có cache/warm-up/prefetch
```

## Việc cần làm tiếp theo

- Tinh chỉnh sanitizer để không chặn nhầm câu trả lời hợp lệ.
- Mở rộng prefetch questions.
- Thêm synonym/alias cache.
- Đo P50/P95 latency cache miss/cache hit.
- Load test 10–100 user.
- Tạo service manager/start script bền vững.
- Tạo cảnh báo auth NotebookLM expired.
