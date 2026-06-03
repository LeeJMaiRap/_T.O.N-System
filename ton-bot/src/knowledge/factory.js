import { NotebookLMProvider } from './notebooklm-provider.js';

export function createKnowledgeProvider(config, logger) {
  if (config.provider === 'notebooklm') return new NotebookLMProvider(config, logger);
  throw new Error(`Unknown knowledge provider: ${config.provider}`);
}
