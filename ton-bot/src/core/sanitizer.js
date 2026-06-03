const TECH_PATTERNS = [
  /\/data\/workspace\//i,
  /\/root\//i,
  /\bopenclaw\s+(status|logs|pairing|gateway|doctor|update|restart|start|stop)\b/i,
  /\bnlm\s+(login|notebook|source|config)\b/i,
  /authentication expired/i,
  /run ['"]?nlm login/i,
  /traceback/i,
  /stack trace/i,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/i,
  /bot\s*token\s*[:=]/i,
  /error:/i
];

export function isTechnicalFailure(text) {
  return TECH_PATTERNS.some(re => re.test(String(text || '')));
}

export function sanitizeAnswer(text) {
  let out = String(text || '').trim();
  out = out.replace(/\*\*/g, '');
  out = out.replace(/\s+\[\d+\]/g, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  if (isTechnicalFailure(out)) return '';
  return out.slice(0, 3800).trim();
}
