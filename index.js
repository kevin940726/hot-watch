const chokidar = require('chokidar');
const Module = require('module');

const SKIP_REGEX = /\/node_modules\/|\.node$/;
const DEFAULT_IGNORED = ['**/*.d.ts', '**/*.tsbuildinfo'];

function patchRequire(parentsMap) {
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

function invalidate(modulePath, parentsMap) {
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
      invalidate(parent.filename, parentsMap);
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
    ignored: [...DEFAULT_IGNORED, ...ignore],
  });

  const parentsMap = new WeakMap();
  const unpatch = patchRequire(parentsMap);

  watcher.on('change', path => {
    Promise.resolve(onBeforeInvalidate(path))
      .then(() => {
        invalidate(path, parentsMap);
      })
      .then(() => onAfterInvalidate(path));
  });

  return function unwatch() {
    unpatch();
    parentsMap.clear();
    return watcher.close();
  };
}

module.exports = watch;
exports.watch = watch;
