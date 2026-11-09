import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudStore,emptyData} from '../cloud-store.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const row=(id,name)=>({id,name,updatedAt:'2026-11-08T12:00:00.000Z'});
test('offline changes survive a reload and stay separate between accounts',()=>{
 const s=storage(),a=new CloudStore(s,'alice:family');
 a.edit({...emptyData(),profiles:[row('a','Alice')]});
 assert.equal(new CloudStore(s,'alice:family').data.profiles[0].name,'Alice');
 assert.equal(Object.keys(new CloudStore(s,'alice:family').pending).length,1);
 assert.equal(new CloudStore(s,'bob:family').data.profiles.length,0);
});
test('remote changes merge with unsent local changes, including deletes',()=>{
 const a=new CloudStore(storage(),'a');
 a.edit({...emptyData(),profiles:[{...row('a','Alice'),deleted:true}]});
 a.receive({...emptyData(),profiles:[row('a','Old Alice'),row('b','Bob')]});
 assert.equal(a.data.profiles.find(x=>x.id==='a').deleted,true);
 assert.equal(a.data.profiles.find(x=>x.id==='b').name,'Bob');
});
test('acknowledging an earlier save never drops a newer queued edit',()=>{
 const a=new CloudStore(storage(),'a');a.edit({...emptyData(),profiles:[row('a','First')]});
 const token=a.pending.profiles__a.token;
 a.edit({...emptyData(),profiles:[row('a','Second')]});a.acknowledge('profiles__a',token);
 assert.equal(a.pending.profiles__a.value.name,'Second');
 a.acknowledge('profiles__a',a.pending.profiles__a.token);assert.equal(Object.keys(a.pending).length,0);
});
test('migration is repeatable and never replaces existing cloud history',()=>{
 const a=new CloudStore(storage(),'a');a.receive({...emptyData(),profiles:[{...row('a','Cloud'),deleted:true}]});
 const source={...emptyData(),profiles:[row('a','Device'),row('b','New')]};
 a.importLocal(source);a.importLocal(source);
 assert.equal(a.data.profiles.length,2);assert.equal(a.data.profiles[0].deleted,true);
 assert.equal(a.pending.profiles__a,undefined);assert.ok(a.pending.profiles__b);
});
test('storage failure does not acknowledge offline durability',()=>{
 const a=new CloudStore({getItem:()=>null,setItem:()=>{throw Error('quota');}},'a');
 assert.throws(()=>a.edit({...emptyData(),profiles:[row('a','Alice')]}),/quota/);
 assert.equal(a.data.profiles.length,0);assert.equal(Object.keys(a.pending).length,0);
});
