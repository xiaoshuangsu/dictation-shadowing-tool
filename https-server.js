const https = require('https');
const http = require('http');
const fs = require('fs');

// 简单的 HTTPS 到 HTTP 代理
const server = https.createServer({
  key: fs.readFileSync('.certs/key.pem'),
  cert: fs.readFileSync('.certs/cert.pem')
}, (req, res) => {
  // 创建到 HTTP 服务器的代理请求
  const proxyReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000'
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('代理错误:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy error');
    }
  });

  req.pipe(proxyReq);
});

server.listen(3443, () => {
  console.log('✅ HTTPS 代理服务器已启动!');
  console.log('🔗 访问地址: https://10.104.15.185:3443');
  console.log('📋 代理到: http://localhost:3000');
});
