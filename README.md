# 🔥👀 `hot-watch`

Watch files and hot reload them

## Installation

```bash
yarn add -D hot-watch
```

## Usage

```js
const http = require('http');
const watch = require('hot-watch');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.end(require('./app')); // module to be hot-reloaded
});

server.listen(3000, () => {
  // Returns a unwatch function
  const unwatch = watch();

  server.on('close', () => {
    unwatch();
  });
});
```

## License

MIT
