export class AnswerCache {
  constructor(config) {
    this.enabled = config.enabled;
    this.ttlMs = (config.ttlSeconds || 86400) * 1000;
    this.maxEntries = config.maxEntries || 1000;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }
  get(key) {
    if (!this.enabled) return null;
    const item = this.map.get(key);
    if (!item || Date.now() > item.expiresAt) {
      if (item) this.map.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return item.value;
  }
  set(key, value) {
    if (!this.enabled) return;
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
  size() { return this.map.size; }
  stats() { return { entries: this.map.size, hits: this.hits, misses: this.misses }; }
}
