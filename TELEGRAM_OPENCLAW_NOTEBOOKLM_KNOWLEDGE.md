# Kho tri thức cài đặt Telegram - OpenClaw - NotebookLM

Tài liệu này ghi lại các bước đúng đã dùng để cấu hình bot Telegram truy vấn kho tri thức NotebookLM thông qua OpenClaw.

Ngày ghi: 2026-06-03 UTC

## 1. Mục tiêu

Thiết lập luồng:

```text
Telegram user → OpenClaw Telegram channel → NotebookLM personal knowledge base → trả lời Telegram
```

Nguồn tri thức chính:

```text
Bao_Cao_Thuc_Tap_Nguyen_Thanh_Doanh-v2.docx
```

Notebook chính:

```text
4a0c4275-6631-4a1f-aea4-bf5c3e139bb9
Autonomous AI Project Management: OpenClaw and Multi-Agent Systems Development
```

Source ID:

```text
746a1193-c6dc-48fb-a1c9-df54b97254cb
Bao_Cao_Thuc_Tap_Nguyen_Thanh_Doanh-v2.docx
```

## 2. Cài `notebooklm-mcp-cli`

Cài CLI bằng `pipx`:

```bash
pipx install notebooklm-mcp-cli
```

Thêm PATH nếu cần:

```bash
export PATH="$PATH:/root/.local/bin"
```

Kiểm tra:

```bash
nlm version
```

Kết quả đã xác nhận:

```text
nlm version 0.6.15
notebooklm-mcp available
```

## 3. Đăng nhập NotebookLM

### 3.1 Đăng nhập thủ công bằng cookie

Tạo file cookie tạm:

```bash
umask 077
mkdir -p /data
cat > /data/notebooklm_cookies.txt
```

Dán cookie vào terminal, kết thúc bằng EOF.

Login:

```bash
export PATH="$PATH:/root/.local/bin"
nlm login --manual --file /data/notebooklm_cookies.txt
```

Kiểm tra auth:

```bash
nlm login --check
```

Xóa cookie raw sau khi login:

```bash
if command -v shred >/dev/null 2>&1; then
  shred -u /data/notebooklm_cookies.txt
else
  rm -f /data/notebooklm_cookies.txt
fi
```

### 3.2 Đăng nhập bằng Chrome CDP

Mở Chrome debug trên Windows:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-notebooklm-auth"
```

Nếu cần cho container truy cập CDP từ WSL/Docker, tạo firewall rule tạm:

```powershell
New-NetFirewallRule -DisplayName "NotebookLM-CDP-9222" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9222 -RemoteAddress LocalSubnet
```

Sau đó login NotebookLM trong cửa sổ Chrome debug.

Tạo local CDP proxy trong container nếu `nlm` không kết nối trực tiếp được tới Chrome:

```js
// /data/workspace/bin/cdp-proxy.js
#!/usr/bin/env node
const http = require('http');
const net = require('net');
const TARGET_HOST = process.env.CDP_TARGET_HOST || 'host.docker.internal';
const TARGET_PORT = Number(process.env.CDP_TARGET_PORT || 9222);
const LISTEN_HOST = process.env.CDP_LISTEN_HOST || '127.0.0.1';
const LISTEN_PORT = Number(process.env.CDP_LISTEN_PORT || 18800);

const server = http.createServer((req, res) => {
  const opts = {
    host: TARGET_HOST,
    port: TARGET_PORT,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: 'localhost' },
  };
  const pr = http.request(opts, (pres) => {
    const headers = { ...pres.headers };
    if (headers.location) headers.location = headers.location.replace(`http://${TARGET_HOST}:${TARGET_PORT}`, `http://${LISTEN_HOST}:${LISTEN_PORT}`);
    const chunks = [];
    pres.on('data', c => chunks.push(c));
    pres.on('end', () => {
      let body = Buffer.concat(chunks);
      const ct = String(headers['content-type'] || '');
      if (ct.includes('application/json') || req.url.startsWith('/json')) {
        let text = body.toString('utf8')
          .replace(/ws:\/\/localhost(?=\/devtools\/)/g, `ws://${LISTEN_HOST}:${LISTEN_PORT}`)
          .replace(new RegExp(`ws://${TARGET_HOST}:${TARGET_PORT}`, 'g'), `ws://${LISTEN_HOST}:${LISTEN_PORT}`)
          .replace(new RegExp(`http://${TARGET_HOST}:${TARGET_PORT}`, 'g'), `http://${LISTEN_HOST}:${LISTEN_PORT}`);
        body = Buffer.from(text);
        headers['content-length'] = String(body.length);
      }
      res.writeHead(pres.statusCode || 502, headers);
      res.end(body);
    });
  });
  pr.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(pr);
});

server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = Object.entries({ ...req.headers, host: 'localhost' })
      .map(([k, v]) => `${k}: ${v}`).join('\r\n');
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => console.log(`CDP proxy http://${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`));
```

Chạy proxy:

```bash
node /data/workspace/bin/cdp-proxy.js
```

Login bằng CDP proxy:

```bash
export PATH="$PATH:/root/.local/bin"
nlm login --provider openclaw --cdp-url http://127.0.0.1:18800 --clear
```

Kết quả đúng:

```text
✓ Successfully authenticated!
Profile: default
Provider: openclaw
Cookies: 48 extracted
CSRF Token: Yes
Credentials saved to: /root/.notebooklm-mcp-cli/profiles/default
```

Kiểm tra auth:

```bash
nlm login --check
```

Kết quả đúng:

```text
✓ Authentication valid!
Notebooks found: 1
```

Sau khi auth xong:

```powershell
Remove-NetFirewallRule -DisplayName "NotebookLM-CDP-9222"
```

Đóng Chrome debug.

## 4. Liệt kê notebook và xác nhận nguồn tri thức

Liệt kê notebook:

```bash
export PATH="$PATH:/root/.local/bin"
nlm notebook list
```

Notebook dùng:

```text
4a0c4275-6631-4a1f-aea4-bf5c3e139bb9
Autonomous AI Project Management: OpenClaw and Multi-Agent Systems Development
```

Source dùng:

```text
746a1193-c6dc-48fb-a1c9-df54b97254cb
Bao_Cao_Thuc_Tap_Nguyen_Thanh_Doanh-v2.docx
```

## 5. Tạo helper query NotebookLM

Tạo file:

```text
/data/workspace/bin/ask_notebooklm
```

Nội dung:

```bash
#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:/root/.local/bin"
NOTEBOOK_ID="${NOTEBOOK_ID:-4a0c4275-6631-4a1f-aea4-bf5c3e139bb9}"
nlm notebook query "$NOTEBOOK_ID" "$*"
```

Cấp quyền chạy:

```bash
chmod +x /data/workspace/bin/ask_notebooklm
```

Test:

```bash
/data/workspace/bin/ask_notebooklm "Dự án thực tập của tôi là gì? Trả lời ngắn."
```

Kết quả đúng có dạng JSON, trong đó có:

```json
{
  "value": {
    "answer": "Dự án thực tập của bạn là **Xây dựng hệ thống Project Manager Agent và định hướng Multi-Agent tự động hóa vòng đời dự án trên nền tảng OpenClaw** ...",
    "sources_used": [
      "746a1193-c6dc-48fb-a1c9-df54b97254cb"
    ]
  }
}
```

## 6. Cấu hình Telegram channel trong OpenClaw

Lưu token Telegram vào file secret:

```text
/data/.openclaw/secrets/telegram-bot-token
```

Quyền file nên giới hạn:

```bash
chmod 600 /data/.openclaw/secrets/telegram-bot-token
```

Cấu hình trong:

```text
/data/.openclaw/openclaw.json
```

Phần Telegram:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "tokenFile": "/data/.openclaw/secrets/telegram-bot-token",
      "dmPolicy": "pairing"
    }
  },
  "plugins": {
    "allow": ["telegram"]
  }
}
```

Kiểm tra trạng thái:

```bash
openclaw status
```

Kết quả đúng:

```text
Telegram │ ON │ OK │ token tokenFile (... · len 46) · accounts 1/1
```

## 7. Pairing Telegram DM

User gửi `/start` tới bot Telegram.

Approve sender:

```bash
openclaw pairing approve telegram <CODE>
```

Kết quả đúng đã có:

```text
Approved telegram sender 5168072926.
Command owner configured telegram:5168072926.
```

Telegram approved sender:

```text
5168072926
```

## 8. Thêm instruction cho OpenClaw dùng NotebookLM khi có câu hỏi Telegram

Thêm vào `/data/workspace/AGENTS.md`:

```markdown
## Telegram → NotebookLM Knowledge Gateway

When a user chats through Telegram and asks about the personal knowledge base, internship report, project details, or document-backed facts, use NotebookLM before answering.

Command:

```bash
/data/workspace/bin/ask_notebooklm "<focused standalone Vietnamese question>"
```

Answer from NotebookLM output only. If no relevant result, say:
`Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?`
```

Thêm vào `/data/workspace/TOOLS.md`:

```markdown
## NotebookLM Personal Knowledge Base

- CLI installed: `/root/.local/bin/nlm` via `notebooklm-mcp-cli`.
- Auth profile: `default` in `/root/.notebooklm-mcp-cli/profiles/default`.
- Main notebook ID: `4a0c4275-6631-4a1f-aea4-bf5c3e139bb9`.
- Source: `Bao_Cao_Thuc_Tap_Nguyen_Thanh_Doanh-v2.docx`.
- Helper command: `/data/workspace/bin/ask_notebooklm "question"`.
- For Telegram knowledge-base questions, query NotebookLM first. Do not answer substantive document questions from general model memory.
- If NotebookLM gives no relevant answer, reply: `Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?`
```

## 9. Chặn bot im lặng với Telegram direct user request

Thêm guard vào `/data/workspace/TOOLS.md`:

```markdown
## Silent Reply Guard
- Never use `NO_REPLY` for direct Telegram/WebChat user questions, especially `inbound_event_kind=user_request`; answer or run the needed tool.
- For Telegram direct knowledge-base questions, run `/data/workspace/bin/ask_notebooklm` first, then answer from that output.
```

Lý do: Telegram direct question từng được xử lý thành `NO_REPLY`, làm bot không trả lời dù session chạy thành công.

## 10. Test end-to-end

Test helper local:

```bash
/data/workspace/bin/ask_notebooklm "Dự án thực tập của tôi là gì? Trả lời ngắn."
```

Test Telegram DM:

```text
Dự án thực tập của tôi là gì?
```

Kết quả đúng: Telegram trả lời dựa trên NotebookLM, đúng dữ liệu từ file báo cáo.

## 11. Quy tắc trả lời khi không tìm thấy dữ liệu

Nếu NotebookLM không có thông tin liên quan, trả lời đúng câu:

```text
Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?
```

## 12. Lưu ý bảo mật

- Không lưu raw cookie lâu dài.
- Xóa file cookie sau khi `nlm login` thành công.
- Không đưa token Telegram vào config/log/chat nếu có thể; dùng `tokenFile`.
- Nếu token Telegram từng bị paste trong chat, nên regenerate token qua `@BotFather` sau khi test.
- Không để firewall rule CDP mở lâu; xóa sau khi auth.
- Không gửi lỗi kỹ thuật, command, path, token, stack trace cho người dùng Telegram public.

## 13. Hướng phát triển production

Hiện tại Telegram đi qua OpenClaw agent rồi gọi NotebookLM. Dùng được cho test và demo.

Production nên tách bot service riêng:

```text
Telegram user → Bot service riêng → Knowledge provider → NotebookLM/Gemini RAG → Telegram reply
```

OpenClaw vẫn là core quản lý:

```text
OpenClaw → quản lý service, logs, cron warm-up, healthcheck, config, secrets, admin/debug
```

Mục tiêu production:

- Không lộ command/log kỹ thuật cho người dân.
- Có `/start`, `/help`, câu chào, fallback thân thiện.
- Có queue và concurrency limit cho 10–100 user.
- Có cache câu hỏi phổ biến.
- Có provider abstraction để đổi từ NotebookLM sang Gemini RAG khi cần.
