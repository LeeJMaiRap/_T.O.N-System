# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Related

- [Agent workspace](/concepts/agent-workspace)

## NotebookLM Personal Knowledge Base

- CLI installed: `/root/.local/bin/nlm` via `notebooklm-mcp-cli`.
- Auth profile: `default` in `/root/.notebooklm-mcp-cli/profiles/default`.
- Main notebook ID: `4a0c4275-6631-4a1f-aea4-bf5c3e139bb9`.
- Source: `Bao_Cao_Thuc_Tap_Nguyen_Thanh_Doanh-v2.docx`.
- Helper command: `/data/workspace/bin/ask_notebooklm "question"`.
- For Telegram knowledge-base questions, query NotebookLM first. Do not answer substantive document questions from general model memory.
- If NotebookLM gives no relevant answer, reply: `Tôi chưa tìm thấy thông tin liên quan trong cơ sở tri thức. Bạn có thể hỏi theo cách khác không?`

## Silent Reply Guard
- Never use `NO_REPLY` for direct Telegram/WebChat user questions, especially `inbound_event_kind=user_request`; answer or run needed tool.
- For Telegram direct knowledge-base questions, run `/data/workspace/bin/ask_notebooklm` first, then answer from that output.
