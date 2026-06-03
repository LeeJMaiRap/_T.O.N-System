import fs from 'fs';

export function createLogger(path) {
  function write(level, event, data = {}) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
    fs.appendFile(path, line + '\n', () => {});
    if (level === 'error') console.error(line);
    else console.log(line);
  }
  return {
    info: (event, data) => write('info', event, data),
    error: (event, data) => write('error', event, data)
  };
}
