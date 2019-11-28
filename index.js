const chokidar = require('chokidar');

const SKIP_REGEX = /\/node_modules\/|\.node$/;

const parentsMap = new WeakMap();

function setParents(modulePath) {
  if (require.cache[modulePath]) {
    require.cache[modulePath].children.forEach(child => {
      if (!parentsMap.has(child)) {
        parentsMap.set(child, new Set());
      }

      parentsMap.get(child).add(require.cache[modulePath]);
    });
  }
}

function invalidate(modulePath) {
  if (
    !modulePath ||
    !require.cache[modulePath] ||
    modulePath === require.main.filename
  ) {
    return;
  }

  const mod = require.cache[modulePath];
  const parents = parentsMap.get(mod);

  if (!SKIP_REGEX.test(modulePath)) {
    delete require.cache[modulePath];
  }

  if (parents) {
    parents.forEach(parent => {
      invalidate(parent.filename);
    });
  }
}

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
        if (!parentsMap.size) {
          Object.keys(require.cache).forEach(modulePath => {
            setParents(modulePath);
          });
        }

        if (require.cache[path]) {
          require.cache[path].children.forEach(child => {
            if (parentsMap.has(child)) {
              parentsMap.get(child).clear();
            }
          });
        }
        setParents(path);

        invalidate(path);
      })
      .then(() => restart());
  });

  return function unwatch() {
    return watcher.close();
  };
}

module.exports = watch;
