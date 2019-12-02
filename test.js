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
    if (changedPath === pathListening) {
      resolvePromise();
    }
  });

  waitFor = changedPath => {
    pathListening = path.join(tmpDir, changedPath);

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
  await writeFile('app.js', `'app: ' + require('./a')`);
  await writeFile('a.js', `'a'`);

  await runServer();

  expect(await get()).toBe('app: a');

  await writeFile('a.js', `'a'`);

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
  await writeFile('app.js', `'app: ' + require('./a') + require('./b')`);
  await writeFile('a.js', `'a' + require('./c')`);
  await writeFile('b.js', `'b' + require('./c')`);
  await writeFile('c.js', `'c'`);

  await runServer();

  expect(await get()).toBe('app: acbc');

  await writeFile('c.js', `'d'`);

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
  await writeFile(
    'app.js',
    `'app: ' + require('./a') + require('./b') + require('./c')`
  );
  await writeFile('a.js', `'a' + require('./b')`);
  await writeFile('b.js', `'b' + require('./c')`);
  await writeFile('c.js', `'c'`);

  await runServer();

  expect(await get()).toBe('app: abcbcc');

  await writeFile('c.js', `'d'`);

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

async function writeFile(fileName, data) {
  const absolutePath = path.join(tmpDir, fileName);

  try {
    await fs.writeFile(absolutePath, `module.exports = ${data};`, {
      flag: 'wx',
    });
  } catch (err) {
    const promise = waitFor(fileName);
    await fs.writeFile(absolutePath, `module.exports = ${data};`);
    await promise;
  }
}
