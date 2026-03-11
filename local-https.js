const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');

// 生成自签名证书
const { execSync } = require('child_process');

try {
  execSync('mkdir -p .certs');
} catch (e) {}

// 生成证书和密钥（如果不存在）
if (!fs.existsSync('.certs/cert.pem') || !fs.existsSync('.certs/key.pem')) {
  console.log('生成自签名证书...');
  const { privateKey } = require('crypto').generateKeyPairSync('rsa', {
    modulus: 2048,
    publicKeyEncoding: 'spki',
    privateKeyEncoding: 'pem'
  });
  
  constForge = require('node-forge');
  const keys = require('node-forge/lib/keys');
  const pki = require('node-forge/lib/pki');
  
  const cert = pki.createCertificate();
  cert.publicKey = pki.publicKeyFromPem(keys.publicKeyPem);
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  
  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'US'
  }];
  
  cert.setSubject(attrs);
  cert.setExtensions([{
    name: 'subjectAltName',
    altNames: [{
      type: 2, // DNS
      value: 'localhost'
    }, {
      type: 2,
      value: '127.0.0.1'
    }]
  }]);
  
  cert.sign(keys.privateKey);
  
  fs.writeFileSync('.certs/cert.pem', pki.certificateToPem(cert));
  fs.writeFileSync('.certs/key.pem', pki.privateKeyToPem(keys.privateKey));
  console.log('证书生成完成！');
}

// 启动 HTTPS 开发服务器
const server = https.createServer({
  key: fs.readFileSync('.certs/key.pem'),
  cert: fs.readFileSync('.certs/cert.pem')
}, (req, res) => {
  // 将请求代理到 localhost:3000
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000'  // 覆盖原始的 host
    }
  };

  const proxy = require('http').request(options, (proxyRes) => {
    // 处理重定向
    if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
      const location = proxyRes.headers.location;
      proxyRes.headers.location = location.replace(/^https?:\/\/[^\/]+/, 'http://10.104.15.185:3000');
    }
    
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('代理错误:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });

  req.pipe(proxy);
});

server.listen(3443, () => {
  console.log('HTTPS 开发服务器已启动！');
  console.log('访问地址: https://10.104.15.185:3443');
  console.log('将 HTTP 请求代理到 http://10.104.15.185:3000');
});
