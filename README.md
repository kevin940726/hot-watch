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

## API

```js
// watch accepts an option object, here are their default values
const unwatch = watch({
  // The directory the watcher is going to watch on,
  // can be either a string or an array of strings
  cwd: process.cwd(),
  // Files should not be watched, expected an array of strings
  ignore: [],
  // The function which will be fired whenever the watcher detect a change and before hot-reloading,
  // you can perform necessary cleanup here
  // Can return void or a Promise
  stop: () => {},
  // The function which will be fired after old modules are disposed,
  // you can re-require modules here to get the changed modules
  // Can return void or a Promise
  restart: () => {},
});

unwatch(); // Stop and close the watcher
```

## License

MIT
