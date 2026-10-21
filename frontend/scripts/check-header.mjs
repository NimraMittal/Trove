import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Requires a running local frontend. All auth responses are test fixtures;
// this deliberately never registers users or accesses a database.
const baseUrl = process.env.HEADER_TEST_URL || 'http://localhost:3001';
const target = new URL(baseUrl);
if (target.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('HEADER_TEST_URL must be an HTTP loopback origin without credentials.');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'trove-header-'));
const chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {stdio:'ignore'});
let spawnError, ws, interceptionError;
chrome.on('error', error => { spawnError = error; });
(async () => {
  // Discover only this run's debugger; never attach to an existing browser.
  let port;
  for(let i=0;i<100;i++) {
    if (spawnError) throw spawnError;
    if (chrome.exitCode !== null) throw new Error('Chrome exited before debugger startup.');
    try {
      const candidate = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      if (Number.isInteger(candidate) && candidate > 0 && candidate < 65536) { port = candidate; break; }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await sleep(100);
  }
  if (!port) throw new Error('Chrome debugger did not start within 10 seconds.');
  const response = await fetch(`http://127.0.0.1:${port}/json`, {signal:AbortSignal.timeout(5000)});
  assert.equal(response.ok, true);
  const page = (await response.json()).find(p=>p.type==='page');
  assert.ok(page, 'Chrome must expose a page target.');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=> {
    const timer=setTimeout(()=>reject(new Error('Chrome WebSocket timed out.')),5000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Chrome WebSocket failed.'));},{once:true});
  });
  let id=0, mode='guest', logoutFails=false;
  const pending=new Map();
  function cmd(method,params={}) { return new Promise((resolve,reject)=> {
    const n=++id;
    const timer=setTimeout(()=>{pending.delete(n);reject(new Error(`Chrome command timed out: ${method}`));},10000);
    pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));
  }); }
  async function handleMessage(e) {
    const m=JSON.parse(e.data);
    if(m.id) { const p=pending.get(m.id); if(!p) return; pending.delete(m.id); clearTimeout(p.timer); if(m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); }
    if(m.method==='Fetch.requestPaused') {
      const p=m.params, url=new URL(p.request.url);
      // Block external requests/redirects and never send auth to a real API.
      if(url.origin!==target.origin) { await cmd('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return; }
      if(!url.pathname.startsWith('/api/auth/')) { await cmd('Fetch.continueRequest',{requestId:p.requestId});return; }
      const isLogout=url.pathname==='/api/auth/logout' && p.request.method==='POST';
      if(!isLogout && !(url.pathname==='/api/auth/me' && p.request.method==='GET')) {
        await cmd('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});
        throw new Error('Unexpected auth request blocked; real auth requests are not allowed.');
      }
      const code=isLogout ? (logoutFails?500:204) : mode==='error'?503:mode==='guest'?401:200;
      const body=code===200?{user:{id:'browser-fixture',email:'fixture@example.test',displayName:'Header Test Cook'}}:{message:'Test service unavailable'};
      if(isLogout && !logoutFails) mode='guest';
      await cmd('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],...(code===204?{}:{body:Buffer.from(JSON.stringify(body)).toString('base64')})});
    }
  }
  ws.addEventListener('message',e=>{void handleMessage(e).catch(error=>{interceptionError=error;});});
  async function evaluate(expression) {if(interceptionError) throw interceptionError; const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;}
  async function waitFor(expression) { for(let i=0;i<100;i++){if(await evaluate(expression))return; await sleep(100);}throw Error('Timed out: '+expression); }
  await cmd('Page.enable');
  await cmd('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await cmd('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await cmd('Page.navigate',{url:baseUrl});
  await waitFor(`!!document.querySelector('header a[href="/login"]')`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true);
  await evaluate(`document.querySelector('button[aria-controls="primary-navigation"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[aria-controls="primary-navigation"]').getAttribute('aria-expanded')`),'true');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#primary-navigation')).display`),'flex');
  await evaluate(`document.querySelector('#primary-navigation a').focus()`);
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await waitFor(`document.querySelector('[aria-controls="primary-navigation"]').getAttribute('aria-expanded')==='false'`);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-controls')`),'primary-navigation');
  assert.equal(await evaluate(`document.querySelector('[aria-controls="primary-navigation"]').getAttribute('aria-expanded')`),'false');
  await evaluate(`document.querySelector('[aria-controls="primary-navigation"]').click()`);
  await waitFor(`document.querySelector('[aria-controls="primary-navigation"]').getAttribute('aria-expanded')==='true'`);
  await evaluate(`document.querySelector('#primary-navigation a[href="/"]').click()`);
  await waitFor(`document.querySelector('[aria-controls="primary-navigation"]').getAttribute('aria-expanded')==='false'`);
  console.log('PASS: mobile guest, no overflow, menu toggle, Escape focus return and link dismissal');
  mode='authenticated';
  await cmd('Page.reload');
  await waitFor(`document.querySelector('header')?.textContent.includes('Header Test Cook')`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true);
  logoutFails=true;
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Log out').click()`);
  await waitFor(`!!document.querySelector('header [role="alert"]')`);
  assert.equal(await evaluate(`document.querySelector('header').textContent.includes('Header Test Cook')`),true);
  logoutFails=false;
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Log out').click()`);
  await waitFor(`!!document.querySelector('header a[href="/login"]')`);
  console.log('PASS: authenticated header, failed logout retains identity, successful logout shows guest');
  mode='error';await cmd('Page.reload');
  await waitFor(`document.querySelector('header')?.textContent.includes('Account unavailable')`);
  mode='guest';
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Retry').click()`);
  await waitFor(`!!document.querySelector('header a[href="/login"]')`);
  console.log('PASS: account failure and retry recovery');
  for(const width of [320,768,1440]) {
    await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),true);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#primary-navigation')).display`),width>760?'flex':'none');
  }
  console.log('PASS: 320px, 768px and 1440px header layout');
  if(interceptionError) throw interceptionError;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  ws?.close();
  if(chrome.pid && chrome.exitCode===null && chrome.signalCode===null) {
    const exited=new Promise(resolve=>chrome.once('exit',resolve));
    chrome.kill();
    await Promise.race([exited,sleep(2000)]);
    if(chrome.exitCode===null && chrome.signalCode===null) {
      chrome.kill('SIGKILL');
      await Promise.race([exited,sleep(2000)]);
    }
  }
  // Remove only the uniquely generated profile owned by this run.
  rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
});
