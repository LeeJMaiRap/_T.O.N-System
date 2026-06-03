#!/usr/bin/env node
const http = require('http');
const net = require('net');
const TARGET_HOST = process.env.CDP_TARGET_HOST || 'host.docker.internal';
const TARGET_PORT = Number(process.env.CDP_TARGET_PORT || 9222);
const LISTEN_HOST = process.env.CDP_LISTEN_HOST || '127.0.0.1';
const LISTEN_PORT = Number(process.env.CDP_LISTEN_PORT || 18800);

const server = http.createServer((req, res) => {
  const opts = {
    host: TARGET_HOST,
    port: TARGET_PORT,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: 'localhost' },
  };
  const pr = http.request(opts, (pres) => {
    const headers = { ...pres.headers };
    if (headers.location) headers.location = headers.location.replace(`http://${TARGET_HOST}:${TARGET_PORT}`, `http://${LISTEN_HOST}:${LISTEN_PORT}`);
    const chunks = [];
    pres.on('data', c => chunks.push(c));
    pres.on('end', () => {
      let body = Buffer.concat(chunks);
      const ct = String(headers['content-type'] || '');
      if (ct.includes('application/json') || req.url.startsWith('/json')) {
        let text = body.toString('utf8')
          .replace(/ws:\/\/localhost(?=\/devtools\/)/g, `ws://${LISTEN_HOST}:${LISTEN_PORT}`)
          .replace(new RegExp(`ws://${TARGET_HOST}:${TARGET_PORT}`, 'g'), `ws://${LISTEN_HOST}:${LISTEN_PORT}`)
          .replace(new RegExp(`http://${TARGET_HOST}:${TARGET_PORT}`, 'g'), `http://${LISTEN_HOST}:${LISTEN_PORT}`);
        body = Buffer.from(text);
        headers['content-length'] = String(body.length);
      }
      res.writeHead(pres.statusCode || 502, headers);
      res.end(body);
    });
  });
  pr.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(pr);
});

server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = Object.entries({ ...req.headers, host: 'localhost' })
      .map(([k, v]) => `${k}: ${v}`).join('\r\n');
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => console.log(`CDP proxy http://${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`));
