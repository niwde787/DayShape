import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('renamed Pages app cleans only older caches in its own scope',async()=>{
  const handlers={},removed=[];
  const context={URL,self:{registration:{scope:'https://niwde787.github.io/DayShape/'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{}},caches:{keys:async()=>['dayshape-shell:/DayShape/:v7','dayshape-shell:/DayShape/:v9','dayshape-shell-v7-insights','dayshape-shell:/forge/:v8','other-app-cache'],delete:async key=>removed.push(key)}};
  vm.runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
  let completion;handlers.activate({waitUntil:p=>completion=p});await completion;
  assert.deepEqual(removed,['dayshape-shell:/DayShape/:v7']);
});
