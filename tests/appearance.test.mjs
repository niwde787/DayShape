import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {startAppearance} from '../appearance.js';

test('saved theme applies before paint; system preference and blocked storage work',async()=>{
  const code=await readFile(new URL('../theme-init.js',import.meta.url),'utf8');
  for(const [saved,deviceDark,expected] of [['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],['invalid',false,'light']]){
    const root={dataset:{}},meta={setAttribute:(key,value)=>{meta[key]=value;}};
    vm.runInNewContext(code,{localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:deviceDark})},document:{documentElement:root,querySelector:()=>meta}});
    assert.equal(root.dataset.theme,expected);assert.equal(meta.content,expected==='dark'?'#14211d':'#f7f7ef');
  }
  const root={dataset:{}};
  vm.runInNewContext(code,{localStorage:{getItem:()=>{throw Error('blocked');}},window:{matchMedia:()=>({matches:true})},document:{documentElement:root,querySelector:()=>null}});
  assert.equal(root.dataset.theme,'dark');
});

test('theme choice persists without replacing the dashboard and reduced motion skips animations',()=>{
  const window=new Window({url:'http://localhost:4180/'});
  const previous=new Map();
  for(const [key,value] of Object.entries({window,document:window.document,localStorage:window.localStorage})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  let controller;
  try {
    window.document.body.innerHTML='<div id="app" data-motion-key="day"><header class="topbar"></header><div class="time-ring"><strong data-time-total="90">1h 30m</strong></div><input id="draft" value="unsaved input"></div>';
    let frames=0;window.requestAnimationFrame=()=>{frames++;return 1;};
    window.matchMedia=query=>({matches:query.includes('reduced-motion'),addEventListener:()=>{}});
    controller=startAppearance();
    assert.equal(frames,0);
    window.document.querySelector('[data-theme-choice="dark"]').click();
    assert.equal(window.document.documentElement.dataset.theme,'dark');
    assert.equal(window.localStorage.getItem('dayshape-theme'),'dark');
    assert.equal(window.document.querySelector('#draft').value,'unsaved input');
    assert.equal(window.document.querySelector('[data-time-total]').textContent,'1h 30m');
    assert.equal(window.document.querySelector('[data-theme-choice="dark"]').getAttribute('aria-pressed'),'true');
    window.document.querySelector('[data-theme-choice="light"]').click();
    assert.equal(window.document.documentElement.dataset.theme,'light');
  } finally {
    controller?.stop();window.happyDOM.abort();
    for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
  }
});
