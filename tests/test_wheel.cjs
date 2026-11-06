const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');

// 実際のアニメーションを最後まで進め、最後に描いた扇形と返却値を照合。
async function check(initial, velocity, token) {
  const queue = [], arcs = [], messages = [];
  const status = {textContent: ''};
  let firstAngle;
  const ctx = new Proxy({}, { get(_target, key) {
    return (...args) => {
      if (key === 'arc') {
        firstAngle ??= args[3];
        arcs.push(args[3]);
      }
    };
  }, set() { return true; } });
  const canvas = {offsetWidth: 600, offsetHeight: 600, getContext: () => ctx};
  const random = [initial, velocity];
  const math = Object.create(Math);
  math.random = () => random.shift();
  const context = vm.createContext({
    Math: math, URLSearchParams, console,
    document: {getElementById: id => id === 'wheelCanvas' ? canvas : status},
    location: {hash: token ? '#token=test-token' : ''},
    requestAnimationFrame: callback => queue.push(callback),
    fetch: async (url, options) => { messages.push({url, ...JSON.parse(options.body)}); return {ok: true}; }
  });
  vm.runInContext(source, context);
  assert.equal(firstAngle, initial * 2 * Math.PI);
  let frames = 0;
  while (queue.length) { queue.shift()(); assert.ok(++frames < 1000); }
  const angle = arcs[arcs.length - 4];
  const slice = Math.PI / 2;
  const chosen = Math.floor(((2 * Math.PI - angle % (2 * Math.PI)) % (2 * Math.PI)) / slice);
  const result = ['vim', 'neovim', 'vscode', 'emacs'][chosen];
  assert.ok(status.textContent.endsWith(result));
  assert.equal(messages.length, token ? 1 : 0);
  if (token) assert.deepEqual(messages[0], {url: '/result', token: 'test-token', result});
  return result;
}
(async () => {
  const results = new Set();
  for (let i = 0; i < 16; i++) results.add(await check(i / 16, 0.5, true));
  assert.equal(results.size, 4);
  await check(0.25, 0, false);
  console.log('wheel: 17 animation cases passed; all four results, random orientation, callback, static mode');
})().catch(error => { console.error(error); process.exitCode = 1; });
