import test from 'node:test';
import assert from 'node:assert/strict';
import {sync} from '../sync.js';
const empty=()=>({version:1,profiles:[],activities:[],entries:[],goals:[],routines:[]});
test('Dropbox retries revision conflicts and merges updates from both devices',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;
 globalThis.sessionStorage={getItem:()=>JSON.stringify({token:'test-only',expires:Date.now()+60000})};
 let local={...empty(),entries:[{id:'local',minutes:60,updatedAt:'2026-01-01'}]},uploads=0,downloads=0;
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/download')){downloads++;const remote={...empty(),entries:[{id:'remote',minutes:downloads*30,updatedAt:`2026-01-0${downloads}`} ]};return new Response(JSON.stringify(remote),{headers:{'Dropbox-API-Result':JSON.stringify({rev:'revision-'+downloads})}});}
  uploads++;const args=JSON.parse(options.headers['Dropbox-API-Arg']);assert.equal(args.mode.update,'revision-'+downloads);
  if(uploads===1)return new Response('{}',{status:409});
  const uploaded=JSON.parse(options.body);assert.equal(uploaded.entries.length,2);assert.equal(uploaded.entries.find(e=>e.id==='remote').minutes,60);return new Response('{}');
 };
 try{await sync(()=>local,d=>{local=d;});assert.equal(uploads,2);assert.equal(downloads,2);}finally{globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage;}
});
test('unknown Dropbox file format never gets overwritten',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.sessionStorage;
 globalThis.sessionStorage={getItem:()=>JSON.stringify({token:'test-only',expires:Date.now()+60000})};
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{"version":99}',{headers:{'Dropbox-API-Result':'{"rev":"r1"}'}});};
 try{await assert.rejects(sync(empty,()=>{}),/not supported/);assert.equal(calls,1);}finally{globalThis.fetch=oldFetch;globalThis.sessionStorage=oldStorage;}
});
