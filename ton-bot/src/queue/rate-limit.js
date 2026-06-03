export class RateLimiter {
  constructor(config) {
    this.perUserMinIntervalMs = config.perUserMinIntervalMs || 3000;
    this.globalPerMinute = config.globalPerMinute || 30;
    this.lastByUser = new Map();
    this.globalHits = [];
    this.rejected = 0;
  }
  check(userId) {
    const now = Date.now();
    const last = this.lastByUser.get(userId) || 0;
    if (now - last < this.perUserMinIntervalMs) {
      this.rejected++;
      return { ok: false, reason: 'per_user' };
    }
    this.globalHits = this.globalHits.filter(t => now - t < 60_000);
    if (this.globalHits.length >= this.globalPerMinute) {
      this.rejected++;
      return { ok: false, reason: 'global' };
    }
    this.lastByUser.set(userId, now);
    this.globalHits.push(now);
    return { ok: true };
  }
  stats() { return { globalWindowCount: this.globalHits.length, rejected: this.rejected }; }
}
