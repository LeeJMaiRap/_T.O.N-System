export class RequestQueue {
  constructor(config, logger) {
    this.maxConcurrent = config.maxConcurrentQueries || 3;
    this.maxQueueSize = config.maxQueueSize || 100;
    this.perUserMaxQueued = config.perUserMaxQueued || 2;
    this.logger = logger;
    this.active = 0;
    this.queue = [];
    this.enqueuedByUser = new Map();
    this.completed = 0;
  }
  canAccept(userId) {
    if (this.queue.length >= this.maxQueueSize) return false;
    return (this.enqueuedByUser.get(userId) || 0) < this.perUserMaxQueued;
  }
  enqueue(userId, fn) {
    this.queue.push({ userId, fn });
    this.enqueuedByUser.set(userId, (this.enqueuedByUser.get(userId) || 0) + 1);
    this.drain();
  }
  drain() {
    while (this.active < this.maxConcurrent && this.queue.length) {
      const item = this.queue.shift();
      this.enqueuedByUser.set(item.userId, Math.max(0, (this.enqueuedByUser.get(item.userId) || 1) - 1));
      this.active++;
      Promise.resolve().then(item.fn).catch(err => this.logger.error('queue_task_error', { error: err.message })).finally(() => {
        this.active--;
        this.completed++;
        this.drain();
      });
    }
  }
  depth() { return this.queue.length; }
  activeCount() { return this.active; }
  stats() { return { depth: this.queue.length, active: this.active, completed: this.completed, maxConcurrent: this.maxConcurrent }; }
}
