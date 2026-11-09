import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {build} from 'esbuild';

test('sign-in isolates cloud profiles; migration is explicit; sign-out restores local profiles',async()=>{
  const window=new Window({url:'http://localhost:4180/'});
  window.document.body.innerHTML='<div id="app"></div><div id="toast"></div><dialog id="modal"></dialog>';
  const local={version:1,profiles:[{id:'local-child',name:'Device child',avatar:'🌱',age:'child',updatedAt:'2026-11-08'}],activities:[],entries:[],goals:[],routines:[]};
  window.localStorage.setItem('forge-data',JSON.stringify(local));
  const old=new Map();
  for(const [key,value] of Object.entries({window,document:window.document,localStorage:window.localStorage,sessionStorage:window.sessionStorage,navigator:window.navigator,location:window.location,FormData:window.FormData})) {
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const realTimeout=globalThis.setTimeout,realInterval=globalThis.setInterval;
  globalThis.setInterval=()=>0;globalThis.setTimeout=(fn,ms,...args)=>{const timer=realTimeout(fn,ms===850?0:ms,...args);timer.unref?.();return timer;};
  const tick=()=>new Promise(resolve=>realTimeout(resolve,20));
  try {
    const bundle=await build({entryPoints:['app.js'],bundle:true,format:'esm',platform:'browser',write:false,plugins:[{
      name:'fake-cloud-account',setup(build){build.onLoad({filter:/[\\/]cloud\.js$/},()=>({loader:'js',contents:`
        export const configured=true;
        export const friendlyError=e=>e.message;
        export class FamilyCloud {
          constructor(callbacks){this.callbacks=callbacks;this.saved=[];this.imports=[];globalThis.testCloud=this;}
          start(){} flush(){}
          async login(){this.user={uid:'parent-one',email:'parent@example.com',emailVerified:true};this.family={id:'family-one',name:'Cloud family',ownerId:'parent-one'};this.callbacks.onState({user:this.user,family:this.family,loading:false});this.callbacks.onData({version:1,profiles:[{id:'cloud-child',name:'Cloud child',avatar:'⚡',age:'child',updatedAt:'2026-11-08'}],activities:[],entries:[],goals:[],routines:[]});this.callbacks.onStatus('Saved to cloud');}
          save(data){this.saved.push(JSON.parse(JSON.stringify(data)));}
          importLocal(data){this.imports.push(data);}
          async logout(){this.user=null;this.family=null;this.callbacks.onState({user:null,family:null,loading:false});}
        }
      `}));}
    }]});
    await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
    await tick();const doc=window.document;
    assert.match(doc.querySelector('main').textContent,/DEVICE CHILD/);
    doc.querySelector('[data-action="settings"]').click();
    const form=doc.querySelector('#account-auth');form.elements.email.value='parent@example.com';form.elements.password.value='test-password';
    form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await tick();
    assert.match(doc.querySelector('main').textContent,/CLOUD CHILD/);
    assert.doesNotMatch(doc.querySelector('main').textContent,/DEVICE CHILD/);
    assert.equal(globalThis.testCloud.imports.length,0);assert.equal(globalThis.testCloud.saved.length,0);
    assert.match(doc.querySelector('#modal').textContent,/Cloud family/);
    doc.querySelector('[data-account="import"]').click();await tick();
    assert.equal(globalThis.testCloud.imports.length,1);assert.equal(globalThis.testCloud.imports[0].profiles[0].id,'local-child');
    doc.querySelector('[data-account="logout"]').click();await tick();
    assert.match(doc.querySelector('main').textContent,/DEVICE CHILD/);assert.doesNotMatch(doc.querySelector('main').textContent,/CLOUD CHILD/);
    assert.deepEqual(JSON.parse(window.localStorage.getItem('forge-data')),local);
  } finally {
    globalThis.setTimeout=realTimeout;globalThis.setInterval=realInterval;delete globalThis.testCloud;
    window.happyDOM.abort();for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
