const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'extension');
const config = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const jwt = (expires = Date.now() / 1000 + 3600) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: expires })).toString('base64url')}.signature`;

function setup({ brokenConfig = false, responseStatus = 200 } = {}) {
    const state = {};
    const handlers = {};
    const updates = [];
    const tabs = new Map();
    const logs = [];
    let now = Date.now();
    const clock = class extends Date { static now() { return now; } };
    const context = vm.createContext({
        URL, Date: clock, atob, AbortSignal, console: { error: (...x) => logs.push(x), warn: (...x) => logs.push(x), debug() {} },
        fetch: async () => ({ ok: responseStatus === 200, status: responseStatus }),
        chrome: {
            storage: { local: {
                setAccessLevel: async () => {},
                get: async () => structuredClone(state),
                set: async values => Object.assign(state, structuredClone(values)),
                remove: async key => { delete state[key]; },
            } },
            action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
            runtime: { getURL: name => `chrome-extension://baitlock/${name}`, onMessage: { addListener: fn => { handlers.message = fn; } } },
            webNavigation: { onBeforeNavigate: { addListener: fn => { handlers.navigate = fn; } } },
            tabs: {
                get: async id => tabs.get(id),
                update: async (id, update) => { tabs.set(id, update); updates.push([id, update]); },
                onRemoved: { addListener: fn => { handlers.remove = fn; } },
            },
        },
    });
    context.importScripts = () => {
        if (brokenConfig) throw new Error('missing config');
        vm.runInContext(config, context);
    };
    vm.runInContext(worker, context);
    const message = (data, sender) => new Promise(resolve => {
        let answered = false;
        const pending = handlers.message(data, sender, answer => { answered = true; resolve(answer); });
        if (pending !== true && !answered) resolve(null);
    });
    return { context, state, handlers, updates, tabs, logs, message, advance: ms => { now += ms; } };
}
const appSender = { url: 'http://localhost:3000/dashboard', frameId: 0 };
const target = 'https://example.com/login?a=1';
const scanSender = (id = 1) => ({ url: `chrome-extension://baitlock/scan.html?url=${encodeURIComponent(target)}`, tab: { id } });
const safe = { tier: 'safe', final_score: 95, reasons: [] };

test('config accepts only plausible unexpired tokens', () => {
    const { context } = setup();
    assert.equal(context.baitlockTokenValid(jwt()), true);
    for (const token of [jwt(1), 'a.b.c', null, 'x'.repeat(5000)]) assert.equal(context.baitlockTokenValid(token), false);
    assert.equal(context.baitlockIsAppUrl('https://evil.example/?next=http://localhost:3000'), false);
    assert.equal(context.baitlockIsAppUrl('http://localhost:30000'), false);
});

test('broken config leaves navigation available and reports failure', () => {
    const runtime = setup({ brokenConfig: true });
    runtime.handlers.navigate({ frameId: 0, url: target, tabId: 1 });
    assert.equal(runtime.updates.length, 0);
    assert.ok(runtime.logs.length);
});

test('auth sync requires the exact dashboard and server validation', async () => {
    const runtime = setup();
    await runtime.message({ type: 'BAITLOCK_AUTH_SYNC', token: jwt() }, { ...appSender, url: 'https://evil.example' });
    assert.equal(runtime.state.baitlock_token, undefined);
    await runtime.message({ type: 'BAITLOCK_AUTH_SYNC', token: 'a.b.c' }, appSender);
    assert.equal(runtime.state.baitlock_token, undefined);
    assert.equal((await runtime.message({ type: 'BAITLOCK_AUTH_SYNC', token: jwt() }, appSender)).ok, true);
    assert.ok(runtime.state.baitlock_token);
    await runtime.message({ type: 'BAITLOCK_AUTH_SYNC', token: null }, appSender);
    assert.equal(runtime.state.baitlock_token, undefined);
    const rejected = setup({ responseStatus: 401 });
    assert.equal((await rejected.message({ type: 'BAITLOCK_AUTH_SYNC', token: jwt() }, appSender)).ok, false);
    assert.equal(rejected.state.baitlock_token, undefined);
});

test('completion validates the scan page, destination, and result', async () => {
    const runtime = setup();
    const sender = scanSender();
    runtime.tabs.set(1, { url: sender.url });
    const complete = { type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: safe };
    assert.equal((await runtime.message(complete, { ...sender, url: sender.url.replace('scan.html', 'scan.html.evil') })).ok, false);
    assert.equal((await runtime.message({ ...complete, targetUrl: 'https://attacker.example' }, sender)).ok, false);
    assert.equal((await runtime.message({ ...complete, data: { ...safe, final_score: '95' } }, sender)).ok, false);
    assert.equal((await runtime.message(complete, sender)).ok, true);
    assert.equal(runtime.updates.at(-1)[1].url, target);
    assert.equal(runtime.state.scan_results[1].data.tier, 'safe');
});

test('stale scan completions cannot replace a newer navigation', async () => {
    const runtime = setup();
    runtime.tabs.set(1, { url: 'https://another.example' });
    assert.equal((await runtime.message({ type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: safe }, scanSender())).ok, false);
    assert.equal(runtime.updates.length, 0);
});

test('parallel scan writes preserve all tab results and storage stays bounded', async () => {
    const runtime = setup();
    await Promise.all([1, 2, 3].map(async id => {
        const sender = scanSender(id);
        runtime.tabs.set(id, { url: sender.url });
        return runtime.message({ type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: safe }, sender);
    }));
    assert.deepEqual(Object.keys(runtime.state.scan_results).sort(), ['1', '2', '3']);
    for (let id = 10; id < 250; id++) runtime.state.scan_results[id] = { timestamp: Date.now(), data: safe, url: target };
    runtime.tabs.set(4, { url: scanSender(4).url });
    await runtime.message({ type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: safe }, scanSender(4));
    assert.equal(Object.keys(runtime.state.scan_results).length, 200);
});

test('bypass entries expire and can only release one matching navigation', async () => {
    const runtime = setup();
    runtime.tabs.set(1, { url: scanSender().url });
    await runtime.message({ type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: null }, scanSender());
    runtime.handlers.navigate({ frameId: 0, tabId: 1, url: target });
    assert.equal(runtime.updates.length, 1);
    runtime.handlers.navigate({ frameId: 0, tabId: 1, url: target });
    assert.equal(runtime.updates.length, 2);
    runtime.tabs.set(2, { url: scanSender(2).url });
    await runtime.message({ type: 'BAITLOCK_SCAN_COMPLETE', targetUrl: target, data: null }, scanSender(2));
    runtime.advance(31000);
    runtime.handlers.navigate({ frameId: 0, tabId: 2, url: target });
    assert.match(runtime.updates.at(-1)[1].url, /scan.html/);
});
