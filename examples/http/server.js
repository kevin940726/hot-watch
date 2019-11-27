const http = require('http');
const watch = require('../../');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.end(require('./a'));
});

server.listen(3000, () => {
  const unwatch = watch({ cwd: __dirname });

  server.on('close', () => {
    unwatch();
  });
});
