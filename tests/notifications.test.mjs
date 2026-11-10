import test from 'node:test';
import assert from 'node:assert/strict';
import {localClock,monday,validateRecipient,report,dueMessages} from '../functions/logic.js';
const settings={label:'Dad',recipientType:'parent',profileId:'p',timezone:'America/New_York',hour:18,midweek:true,weekly:true,flags:true};
const profile={kind:'profiles',value:{id:'p',name:'Alex',timeTargets:{screenMinutes:60}}};
const activity={kind:'activities',value:{id:'game',profileId:'p',name:'Video games'}};
const row=(date,minutes=120,extra={})=>({kind:'entries',value:{id:date,profileId:'p',activityId:'game',kind:'actual',date,minutes,...extra}});
test('notification clock respects local day and DST',()=>{
  assert.deepEqual(localClock(new Date('2026-11-02T00:30:00Z'),'America/New_York'),{date:'2026-11-01',hour:19});
  assert.equal(localClock(new Date('2026-07-01T22:00:00Z'),'America/New_York').hour,18);
  assert.equal(monday('2027-01-01'),'2026-12-28');
});
test('recipient settings reject invalid timezone, quiet hours and labels',()=>{
  assert.equal(validateRecipient(settings).recipientType,'parent');
  for(const extra of [{timezone:'bad/zone'},{hour:23},{label:''},{recipientType:'stranger'}])assert.throws(()=>validateRecipient({...settings,...extra}));
});
test('weekly recap summarizes only the completed previous week',()=>{
  const records=[profile,activity,row('2026-11-08'),row('2026-11-09',600)];
  const result=dueMessages({...settings,flags:false},records,new Date('2026-11-09T23:15:00Z'));
  assert.equal(result.length,1);assert.equal(result[0].key,'2026-11-02-weekly');assert.match(result[0].body,/2h recorded/);
});
test('midweek uses recorded time and flags exclude plans, deleted and future entries',()=>{
  const records=[profile,activity,row('2026-11-11'),row('2026-11-12',600),row('2026-11-10',600,{kind:'plan'}),row('2026-11-10',600,{deleted:true}),row('2026-11-10',600,{profileId:'other'})];
  const result=dueMessages(settings,records,new Date('2026-11-11T23:00:00Z'));
  assert.deepEqual(result.map(m=>m.type),['midweek','flags']);assert.match(result[0].body,/2h recorded/);assert.match(result[1].body,/1h above/);
});
test('quiet hours, disabled choices and missing data produce no notifications',()=>{
  const records=[profile,activity,row('2026-11-11')];
  assert.deepEqual(dueMessages(settings,records,new Date('2026-11-12T03:00:00Z')),[]);
  assert.deepEqual(dueMessages({...settings,midweek:false,weekly:false,flags:false},records,new Date('2026-11-11T23:00:00Z')),[]);
  assert.deepEqual(dueMessages(settings,[profile,activity],new Date('2026-11-11T23:00:00Z')),[]);
  assert.deepEqual(dueMessages(settings,[{...profile,value:{...profile.value,deleted:true}},activity,row('2026-11-11')],new Date('2026-11-11T23:00:00Z')),[]);
});
test('screen tag overrides inference and max goals flag independently',()=>{
  const records=[profile,{...activity,value:{...activity.value,screenTime:false}},row('2026-11-11'),{kind:'goals',value:{profileId:'p',activityId:'game',week:'2026-11-09',direction:'max',minutes:30}}];
  const r=report(records,'p','2026-11-09','2026-11-11');assert.equal(r.screen,0);assert.equal(r.flags.length,1);assert.match(r.flags[0],/1.5h above its goal/);
});
test('repeated scheduler evaluations generate stable weekly deduplication keys',()=>{
  const records=[profile,activity,row('2026-11-11')];
  const a=dueMessages(settings,records,new Date('2026-11-11T23:00:00Z')),b=dueMessages(settings,records,new Date('2026-11-11T23:15:00Z'));
  assert.deepEqual(a.map(m=>m.key),b.map(m=>m.key));
});
