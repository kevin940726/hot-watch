const watch = require('./');

function hotWatchMiddleware({
  cwd,
  ignore,
  onBeforeInvalidate = () => {},
  onAfterInvalidate = () => {},
} = {}) {
  let promise = Promise.resolve();
  let resolvePromise;

  const unwatch = watch({
    cwd,
    ignore,
    onBeforeInvalidate(path) {
      promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      return onBeforeInvalidate(path);
    },
    onAfterInvalidate(path) {
      return Promise.resolve(onAfterInvalidate(path)).then(() => {
        resolvePromise();
      });
    },
  });

  return (req, res, next) => {
    if (req.connection.server) {
      req.connection.server.once('close', unwatch);
    }

    promise.then(next);
  };
}

module.exports = hotWatchMiddleware;
