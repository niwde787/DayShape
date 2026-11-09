import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {build} from 'esbuild';

test('unconfigured cloud keeps local onboarding, activity logging, and setup access usable',async()=>{
  const window=new Window({url:'http://localhost:4180/'});
  window.document.body.innerHTML='<div id="app"></div><div id="toast"></div><dialog id="modal"></dialog>';
  const old=new Map();
  for(const [key,value] of Object.entries({window,document:window.document,localStorage:window.localStorage,sessionStorage:window.sessionStorage,navigator:window.navigator,location:window.location,FormData:window.FormData})) {
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const realTimeout=globalThis.setTimeout,realInterval=globalThis.setInterval;
  globalThis.setInterval=()=>0;
  globalThis.setTimeout=(fn,ms,...args)=>{const timer=realTimeout(fn,ms===850?0:ms,...args);timer.unref?.();return timer;};
  try {
    const bundle=await build({entryPoints:['app.js'],bundle:true,format:'esm',platform:'browser',write:false,plugins:[{
      name:'test-no-live-firebase',setup(build){build.onLoad({filter:/firebase-config\.js$/},()=>({contents:'export const firebaseConfig = {};',loader:'js'}));}
    }]});
    await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    await new Promise(resolve=>realTimeout(resolve,25));
    const doc=window.document;
    assert.ok(doc.querySelector('#profile-form'));
    doc.querySelector('[data-action="settings"]').click();
    assert.match(doc.querySelector('#modal').textContent,/finish setup/);
    assert.equal(doc.querySelector('#modal a.primary').getAttribute('href'),'./firebase-setup.html');
    doc.querySelector('[data-action="close"]').click();
    doc.querySelector('#profile-form [name=name]').value='Test child';
    doc.querySelector('#profile-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    assert.match(doc.querySelector('main').textContent,/TEST CHILD/);
    const saved=JSON.parse(window.localStorage.getItem('forge-data'));
    assert.equal(saved.profiles.length,1);
    doc.querySelector('[data-action="add"]').click();
    doc.querySelector('#activity-select').value=saved.activities.find(a=>a.name==='Practice').id;
    doc.querySelector('#entry-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(JSON.parse(window.localStorage.getItem('forge-data')).entries[0].minutes,60);
    assert.match(doc.querySelector('.activities-card').textContent,/Practice/);
    doc.querySelector('[data-action="add"]').click();
    doc.querySelector('#entry-form [name=hours]').value='24';
    doc.querySelector('#entry-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    assert.match(doc.querySelector('#entry-error').textContent,/no more than 24 hours/);
    assert.equal(JSON.parse(window.localStorage.getItem('forge-data')).entries.length,1);
  } finally {
    globalThis.setTimeout=realTimeout;globalThis.setInterval=realInterval;
    window.happyDOM.abort();
    for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
