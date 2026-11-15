import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {buildWeeklyEmail,eligibleEmail,reportWindow} from '../weekly-email.js';
import {createWeeklyEmailUI} from '../weekly-email-ui.js';
const data={profiles:[{id:'p',name:'Alex <test>',timeTargets:{screenMinutes:60}}],activities:[{id:'gaming',profileId:'p',name:'Video games',category:'play',screenTime:true}],goals:[],routines:[],entries:[{id:'e',profileId:'p',activityId:'gaming',date:'2026-11-09',minutes:120,kind:'actual'},{id:'plan',profileId:'p',activityId:'gaming',date:'2026-11-10',minutes:300,kind:'plan'},{id:'future',profileId:'p',activityId:'gaming',date:'2026-11-16',minutes:500,kind:'actual'},{id:'deleted',profileId:'p',activityId:'gaming',date:'2026-11-10',minutes:100,kind:'actual',deleted:true}]};
test('Monday window handles DST and includes only the previous complete week',()=>{
  assert.deepEqual(reportWindow(new Date('2026-11-16T14:00:00Z')),{start:'2026-11-09',end:'2026-11-15',due:true});
  assert.equal(reportWindow(new Date('2026-07-13T13:00:00Z')).due,true);
  assert.equal(reportWindow(new Date('2026-11-16T13:00:00Z')).due,false);
  assert.equal(reportWindow(new Date('2026-11-17T14:00:00Z')).due,false);
});
test('report uses actual totals, escapes HTML, marks gaps and includes limit flags',()=>{
  const r=buildWeeklyEmail(data,'2026-11-09');assert.match(r.text,/2h recorded · 1\/7 days logged · 2h screen time/);assert.match(r.text,/166h not recorded/);assert.match(r.text,/1h above/);assert.match(r.html,/Alex &lt;test&gt;/);assert.doesNotMatch(r.html,/Alex <test>/);
  const empty=buildWeeklyEmail({...data,entries:[]},'2026-11-09');assert.match(empty.text,/No time was logged/);
  assert.equal(buildWeeklyEmail({...data,profiles:[{...data.profiles[0],deleted:true}]},'2026-11-09'),null);
});
test('only current verified opted-in members at the consented email qualify',()=>{
  const p={enabled:true,consentVersion:1,email:'a@example.com',familyId:'f'},a={email:'A@example.com',emailVerified:true},link={familyId:'f'};
  assert.equal(eligibleEmail(p,a,link,true),true);
  for(const account of [{...a,disabled:true},{...a,emailVerified:false},{...a,email:'new@example.com'},null])assert.ok(!eligibleEmail(p,account,link,true));
  assert.ok(!eligibleEmail({...p,enabled:false},a,link,true));assert.ok(!eligibleEmail(p,a,link,false));assert.ok(!eligibleEmail(p,a,{familyId:'other'},true));
});
test('email preference UI shows setup pending and saves explicit opt-in only',async()=>{
  const window=new Window(),old=globalThis.document;globalThis.document=window.document;const saved=[];
  try{
    const ui=createWeeklyEmailUI({getState:()=>({user:{uid:'a',email:'a@example.com',emailVerified:true},family:{id:'f'}}),cloud:{weeklyEmailSettings:async()=>({}),saveWeeklyEmail:async v=>saved.push(v)},modal:html=>window.document.body.innerHTML=html,toast:()=>{}});
    await ui.show();assert.match(window.document.body.textContent,/setup is pending/);const f=window.document.querySelector('form');assert.equal(f.elements.enabled.checked,false);assert.equal(saved.length,0);
    f.elements.enabled.checked=true;await f.onsubmit({preventDefault(){}});assert.deepEqual(saved,[true]);
  }finally{window.happyDOM.abort();if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('Apps Script claims once, rechecks opt-out, and does not retry ambiguous submission',async()=>{
  const source=await readFile(new URL('../email-script/Code.gs',import.meta.url),'utf8');
  for(const mode of ['normal','revoked','failure']){
    const sent=[],docs=new Map(),p={familyId:'f',enabled:true},account={email:'a@example.com'};let checks=0;
    const context=vm.createContext({console:{warn(){}},DayShapeEmail:{reportWindow:()=>({due:true,start:'2026-11-09'}),buildWeeklyEmail:()=>({subject:'Report',text:'Text',html:'HTML'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>10,sendEmail:msg=>{sent.push(msg);if(mode==='failure')throw Error('ambiguous');}}});
    vm.runInContext(source,context);
    context.get_=path=>path==='deliveryServices/weeklyEmail'?{enabled:true}:docs.get(path);
    context.list_=()=>[{id:'a',enabled:true}];context.data_=()=>data;
    context.recipient_=()=>{checks++;return mode==='revoked'&&checks>=2?null:{preference:p,account};};
    context.patch_=(path,values,create)=>{if(create&&docs.has(path))return null;docs.set(path,values);return {};};
    if(mode==='failure')assert.throws(()=>context.sendMondayReports(),/could not be processed/);else context.sendMondayReports();
    context.sendMondayReports();assert.equal(sent.length,mode==='revoked'?0:1);
  }
});
