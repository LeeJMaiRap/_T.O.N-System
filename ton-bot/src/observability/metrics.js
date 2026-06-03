export class Metrics {
  constructor() {
    this.requests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.providerErrors = 0;
    this.latencies = [];
  }
  recordRequest() { this.requests++; }
  recordCacheHit() { this.cacheHits++; }
  recordCacheMiss() { this.cacheMisses++; }
  recordProviderError() { this.providerErrors++; }
  recordLatency(ms) {
    this.latencies.push(ms);
    if (this.latencies.length > 1000) this.latencies.shift();
  }
  percentile(p) {
    if (!this.latencies.length) return 0;
    const arr = [...this.latencies].sort((a,b)=>a-b);
    return arr[Math.min(arr.length - 1, Math.floor((p / 100) * (arr.length - 1)))];
  }
  snapshot() {
    return {
      requests: this.requests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      providerErrors: this.providerErrors,
      latencyMs: {
        count: this.latencies.length,
        p50: this.percentile(50),
        p95: this.percentile(95),
        max: this.latencies.length ? Math.max(...this.latencies) : 0
      }
    };
  }
}
