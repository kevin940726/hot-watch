const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

let tmpDir;
let serverProcess;
let watcher;
let waitFor;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep));

  await fs.writeFile(
    path.join(tmpDir, 'server.js'),
    `const watch = require('${__dirname}');
const server = require('http').createServer((req, res) => {
  res.statusCode = 200;
  res.end(require('./app'));
}).listen(3000, () => {
  const unwatch = watch();
  server.on('close', unwatch);
});`
  );

  let resolvePromise;
  let promise;
  let pathListening;

  watcher = chokidar.watch(tmpDir);

  watcher.on('change', changedPath => {
    if (pathListening && changedPath === path.join(tmpDir, pathListening)) {
      resolvePromise();
    }
  });

  waitFor = changedPath => {
    pathListening = changedPath;

    promise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    return promise;
  };

  await new Promise(resolve => {
    watcher.on('ready', resolve);
  });
});

afterEach(() => {
  serverProcess.kill();
  watcher.close();
});

test('simple direct dependency', async () => {
  /**
   * R
   * |
   * a (<-> b)
   */
  await fs.writeFile(
    path.join(tmpDir, 'app.js'),
    `module.exports = 'app: ' + require('./a');`
  );
  await fs.writeFile(path.join(tmpDir, 'a.js'), `module.exports = 'a';`);

  await runServer();

  expect(await get()).toBe('app: a');

  const promise = waitFor('a.js');
  await fs.writeFile(path.join(tmpDir, 'a.js'), `module.exports = 'b';`);
  await promise;

  expect(await get()).toBe('app: b');
});

test('circle dependencies', async () => {
  /**
   *   R
   *  / \
   * a   b
   *  \ /
   *   c (<-> d)
   */
  await fs.writeFile(
    path.join(tmpDir, 'app.js'),
    `module.exports = 'app: ' + require('./a') + require('./b');`
  );
  await fs.writeFile(
    path.join(tmpDir, 'a.js'),
    `module.exports = 'a' + require('./c');`
  );
  await fs.writeFile(
    path.join(tmpDir, 'b.js'),
    `module.exports = 'b' + require('./c');`
  );
  await fs.writeFile(path.join(tmpDir, 'c.js'), `module.exports = 'c';`);

  await runServer();

  expect(await get()).toBe('app: acbc');

  const promise = waitFor('c.js');
  await fs.writeFile(path.join(tmpDir, 'c.js'), `module.exports = 'd';`);
  await promise;

  expect(await get()).toBe('app: adbd');
});

test('more complex dependencies', async () => {
  /**
   *    R
   *  / | \
   * a  |  |
   *  \ |  |
   *    b  |
   *     \ |
   *       c (<-> d)
   */
  await fs.writeFile(
    path.join(tmpDir, 'app.js'),
    `module.exports = 'app: ' + require('./a') + require('./b') + require('./c');`
  );
  await fs.writeFile(
    path.join(tmpDir, 'a.js'),
    `module.exports = 'a' + require('./b');`
  );
  await fs.writeFile(
    path.join(tmpDir, 'b.js'),
    `module.exports = 'b' + require('./c');`
  );
  await fs.writeFile(path.join(tmpDir, 'c.js'), `module.exports = 'c';`);

  await runServer();

  expect(await get()).toBe('app: abcbcc');

  const promise = waitFor('c.js');
  await fs.writeFile(path.join(tmpDir, 'c.js'), `module.exports = 'd';`);
  await promise;

  expect(await get()).toBe('app: abdbdd');
});

/* -------------------- Helpers -------------------- */
async function get() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000', res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('error', reject);

      res.on('end', () => {
        resolve(data);
      });
    });
  });
}

async function runServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', [path.join(tmpDir, 'server.js')], {
      cwd: tmpDir,
    });

    function checkPort() {
      setTimeout(() => {
        get()
          .then(() => resolve(serverProcess))
          .catch(() => checkPort());
      }, 100);
    }

    checkPort();
  });
}
