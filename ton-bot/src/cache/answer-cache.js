import fs from 'fs';

export class AnswerCache {
  constructor(config) {
    this.enabled = config.enabled;
    this.ttlMs = (config.ttlSeconds || 86400) * 1000;
    this.maxEntries = config.maxEntries || 1000;
    this.persistFile = config.persistFile || null;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.load();
  }
  load() {
    if (!this.persistFile) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistFile, 'utf8'));
      const now = Date.now();
      for (const [key, item] of Object.entries(data.entries || {})) {
        if (item.expiresAt > now) this.map.set(key, item);
      }
    } catch {}
  }
  save() {
    if (!this.persistFile) return;
    try {
      fs.mkdirSync(new URL('.', `file://${this.persistFile}`).pathname, { recursive: true });
      fs.writeFileSync(this.persistFile, JSON.stringify({ savedAt: Date.now(), entries: Object.fromEntries(this.map) }, null, 2));
    } catch {}
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
    this.sets++;
    this.save();
  }
  size() { return this.map.size; }
  stats() { return { entries: this.map.size, hits: this.hits, misses: this.misses, sets: this.sets, persistFile: this.persistFile }; }
}
