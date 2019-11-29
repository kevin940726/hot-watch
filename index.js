const chokidar = require('chokidar');
const Module = require('module');

const SKIP_REGEX = /\/node_modules\/|\.node$/;

const parentsMap = new WeakMap();

function patchRequire() {
  const originalRequire = Module.prototype.require;

  const { proxy, revoke } = Proxy.revocable(originalRequire, {
    apply(target, thisArg, argumentsList) {
      if (thisArg) {
        for (const child of thisArg.children) {
          if (parentsMap.has(child)) {
            parentsMap.get(child).delete(thisArg);
          }
        }
      }

      const returnModule = Reflect.apply(target, thisArg, argumentsList);

      if (thisArg) {
        for (const child of thisArg.children) {
          if (!parentsMap.has(child)) {
            parentsMap.set(child, new Set());
          }

          parentsMap.get(child).add(thisArg);
        }
      }

      return returnModule;
    },
  });

  Module.prototype.require = proxy;

  return function unpatch() {
    Module.prototype.require = originalRequire;
    revoke();
  };
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
    parentsMap.delete(mod);
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
  onBeforeInvalidate = () => {},
  onAfterInvalidate = () => {},
} = {}) {
  const watcher = chokidar.watch(cwd, {
    ignored: ['**/*.d.ts', '**/*.tsbuildinfo', ...ignore],
  });

  const unpatch = patchRequire();

  watcher.on('change', path => {
    Promise.resolve(onBeforeInvalidate(path))
      .then(() => {
        invalidate(path);
      })
      .then(() => onAfterInvalidate(path));
  });

  return function unwatch() {
    unpatch();
    return watcher.close();
  };
}

module.exports = watch;
exports.watch = watch;
