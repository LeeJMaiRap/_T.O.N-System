import { spawn } from 'child_process';

export class NotebookLMProvider {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  async query(question, options = {}) {
    const suffix = options.maxSentences ? ` Trả lời ngắn, tối đa ${options.maxSentences} câu.` : '';
    const notebook = this.selectNotebook(question);
    const rawText = await runCommand('/root/.local/bin/nlm', ['notebook', 'query', notebook.id, `${question}${suffix}`], 90_000);
    const raw = JSON.parse(rawText);
    const value = raw.value || raw;
    return {
      answer: value.answer || '',
      sources: value.sources_used || [],
      confidence: 'medium',
      notebook: notebook.name,
      raw
    };
  }

  selectNotebook(question) {
    const q = String(question || '').toLowerCase();
    const notebooks = this.config.notebooks || [];
    let best = null;
    let bestScore = 0;
    for (const nb of notebooks) {
      const score = (nb.keywords || []).reduce((n, kw) => n + (q.includes(String(kw).toLowerCase()) ? 1 : 0), 0);
      if (score > bestScore) { best = nb; bestScore = score; }
    }
    if (best) return best;
    return { id: this.config.defaultNotebookId || this.config.notebookId, name: 'default' };
  }

  async healthCheck() {
    try {
      const out = await runShell('export PATH="$PATH:/root/.local/bin"; nlm login --check', 20_000);
      return out.includes('Authentication valid');
    } catch {
      return false;
    }
  }
}

function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, PATH: `${process.env.PATH || ''}:/root/.local/bin` } });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('provider_timeout')); }, timeoutMs);
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `command_exit_${code}`));
    });
  });
}

function runShell(command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command]);
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('health_timeout')); }, timeoutMs);
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `shell_exit_${code}`));
    });
  });
}
