import { normalizeQuestion } from '../core/normalizer.js';
import { sanitizeAnswer, isTechnicalFailure } from '../core/sanitizer.js';

function isNotFoundAnswer(answer) {
  const a = String(answer || '').trim().toLowerCase();
  return (
    a.startsWith('tôi chưa tìm thấy') ||
    a.startsWith('không tìm thấy') ||
    a.startsWith('tài liệu không đề cập') ||
    a.startsWith('trong tài liệu nguồn không đề cập') ||
    a.startsWith('hiện chưa có thông tin')
  );
}

export async function handleMessage(state, msg) {
  const { bot, templates, cache, queue, rateLimiter, provider, logger, metrics } = state;
  metrics.recordRequest();
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = String(msg.text || '').trim();
  if (!text) {
    await bot.sendMessage(chatId, templates.help);
    return;
  }

  if (text === '/start') return bot.sendMessage(chatId, templates.start);
  if (text === '/help') return bot.sendMessage(chatId, templates.help);

  const rl = rateLimiter.check(userId);
  if (!rl.ok) return bot.sendMessage(chatId, templates.rateLimited);

  const normalized = normalizeQuestion(text);
  const cached = cache.get(normalized);
  if (cached) {
    metrics.recordCacheHit();
    logger.info('cache_hit', { userId, q: normalized.slice(0, 80) });
    return bot.sendMessage(chatId, cached.answer);
  }
  metrics.recordCacheMiss();

  if (!queue.canAccept(userId)) return bot.sendMessage(chatId, templates.queueFull);

  await bot.sendChatAction(chatId, 'typing');
  queue.enqueue(userId, async () => {
    const started = Date.now();
    try {
      const result = await provider.query(text, { userId, language: 'vi', maxSentences: 5 });
      let answer = result?.answer || '';
      answer = sanitizeAnswer(answer);
      if (!answer || isTechnicalFailure(answer)) answer = templates.backendError;
      if (isNotFoundAnswer(answer)) answer = templates.notFound;
      cache.set(normalized, { answer, sources: result?.sources || [] });
      const latencyMs = Date.now() - started;
      metrics.recordLatency(latencyMs);
      await bot.sendMessage(chatId, answer);
      logger.info('query_ok', { userId, latencyMs, notebook: result?.notebook, sources: result?.sources?.length || 0 });
    } catch (err) {
      const latencyMs = Date.now() - started;
      metrics.recordLatency(latencyMs);
      metrics.recordProviderError();
      logger.error('query_error', { userId, latencyMs, error: err.message });
      await bot.sendMessage(chatId, templates.backendError);
    }
  });
}
