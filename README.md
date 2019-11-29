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
  // Module to be hot-reloaded
  // Be sure to dynamic require them, or else have to re-require them in `onAfterInvalidate`
  res.end(require('./app'));
});

server.listen(3000, () => {
  // Returns a unwatch function
  const unwatch = watch();

  server.on('close', () => {
    // Remember to call un-watch to free the process
    unwatch();
  });
});
```

## API

```js
// watch accepts an optional option object and here are their default values
const unwatch = watch({
  // The directory the watcher is going to watch on,
  // can be either a string or an array of strings
  cwd: process.cwd(),
  // Files should not be watched, expected an array of strings
  ignore: [],
  // The function which will be fired with changed file path whenever the watcher detect a change and before hot-reloading,
  // Can return void or a Promise
  onBeforeInvalidate: path => {},
  // The function which will be fired with changed file path after old modules are invalidated,
  // you can re-require modules here to update to the latest modules if necessary
  // Can return void or a Promise
  onAfterInvalidate: path => {},
});

unwatch(); // Stop and close the watcher
```

## How

The basic idea is to clean up `require.cache` key whenever the files changed. We have to walk up the require tree to delete the caches for all it's parents. The native module API only stores the first cached parent for each module. In order to get all the parents and their parents and so on, we monkey-patch `require` to store all their parents in an internal `parentsMap`.

## License

MIT
