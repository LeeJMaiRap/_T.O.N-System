import fs from 'fs';
import http from 'http';
import { TelegramBot } from './bot/telegram.js';
import { createKnowledgeProvider } from './knowledge/factory.js';
import { AnswerCache } from './cache/answer-cache.js';
import { RequestQueue } from './queue/request-queue.js';
import { RateLimiter } from './queue/rate-limit.js';
import { handleMessage } from './bot/message-handler.js';
import { createLogger } from './observability/logger.js';
import { Metrics } from './observability/metrics.js';
import { normalizeQuestion } from './core/normalizer.js';
import { sanitizeAnswer, isTechnicalFailure } from './core/sanitizer.js';

const root = new URL('..', import.meta.url).pathname;
const config = JSON.parse(fs.readFileSync(`${root}/config/bot.config.json`, 'utf8'));
const templates = JSON.parse(fs.readFileSync(`${root}/config/templates.vi.json`, 'utf8'));
const logger = createLogger(`${root}/logs/ton-bot.log`);

const token = fs.readFileSync(config.telegram.tokenFile, 'utf8').trim();
const bot = new TelegramBot(token, logger);
const provider = createKnowledgeProvider(config.knowledge, logger);
const cache = new AnswerCache(config.cache);
const queue = new RequestQueue(config.queue, logger);
const rateLimiter = new RateLimiter(config.rateLimit);
const metrics = new Metrics();
const startedAt = Date.now();

const state = { config, templates, bot, provider, cache, queue, rateLimiter, logger, metrics };

function isAllowed(userId) {
  const allowed = config.telegram.allowedUsers || [];
  return allowed.includes('*') || allowed.includes(String(userId));
}

async function processUpdate(update) {
  try {
    const msg = update.message;
    if (!msg || !msg.chat || !msg.from) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAllowed(userId)) {
      await bot.sendMessage(chatId, 'Bot đang trong giai đoạn thử nghiệm giới hạn. Vui lòng liên hệ quản trị viên.');
      return;
    }
    await handleMessage(state, msg);
  } catch (err) {
    logger.error('process_update_error', { error: err.message });
  }
}

async function warmup(reason = 'manual') {
  const questionsFile = config.cache.prefetchQuestionsFile;
  let questions = [];
  try { questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8')); } catch {}
  const results = [];
  for (const q of questions) {
    const key = normalizeQuestion(q);
    if (cache.get(key)) { results.push({ question: q, status: 'cache_hit' }); continue; }
    const started = Date.now();
    try {
      const result = await provider.query(q, { language: 'vi', maxSentences: config.knowledge.maxSentences || 5 });
      let answer = sanitizeAnswer(result.answer || '');
      if (!answer || isTechnicalFailure(answer)) throw new Error('sanitized_empty');
      cache.set(key, { answer, sources: result.sources || [] });
      results.push({ question: q, status: 'ok', latencyMs: Date.now() - started, notebook: result.notebook });
    } catch (err) {
      results.push({ question: q, status: 'error', error: err.message, latencyMs: Date.now() - started });
      logger.error('warmup_error', { reason, question: q, error: err.message });
    }
  }
  logger.info('warmup_done', { reason, results: results.map(r => ({ status: r.status, latencyMs: r.latencyMs, notebook: r.notebook })) });
  return results;
}

function startHealthServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      let providerOk = false;
      try { providerOk = await provider.healthCheck(); } catch { providerOk = false; }
      const body = {
        status: providerOk ? 'ok' : 'degraded',
        telegram: 'ok',
        provider: providerOk ? 'ok' : 'error',
        cacheEntries: cache.size(),
        queueDepth: queue.depth(),
        activeQueries: queue.activeCount(),
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
      };
      res.writeHead(providerOk ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body, null, 2));
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ metrics: metrics.snapshot(), cache: cache.stats(), queue: queue.stats(), rateLimit: rateLimiter.stats() }, null, 2));
      return;
    }
    if (req.url === '/warmup') {
      const results = await warmup('http');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, results }, null, 2));
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  server.listen(config.server.port, config.server.host, () => {
    logger.info('health_server_started', config.server);
  });
}

startHealthServer();
logger.info('ton_bot_starting', { username: 'unknown' });
warmup('startup').catch(err => logger.error('warmup_startup_error', { error: err.message }));
await bot.deleteWebhook();
bot.poll(processUpdate);
