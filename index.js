const chokidar = require('chokidar');

const SKIP_REGEX = /\/node_modules\/|\.node$/;

function watch({
  cwd = process.cwd(),
  ignore = [],
  stop = () => {},
  restart = () => {},
} = {}) {
  const watcher = chokidar.watch(cwd, {
    ignored: ['**/*.d.ts', '**/*.tsbuildinfo', ...ignore],
  });

  watcher.on('change', path => {
    Promise.resolve(stop())
      .then(() => {
        let filePath = path;

        while (
          filePath &&
          require.cache[filePath] &&
          filePath !== require.main.filename
        ) {
          const parent = require.cache[filePath].parent;

          if (!SKIP_REGEX.test(filePath)) {
            delete require.cache[filePath];
          }

          filePath = parent && parent.id;
        }
      })
      .then(() => restart());
  });

  return function unwatch() {
    return watcher.close();
  };
}

module.exports = watch;
