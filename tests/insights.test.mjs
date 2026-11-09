import test from 'node:test';
import assert from 'node:assert/strict';
import {isScreen,timeBalance,weeklyInsights} from '../insights.js';
const profile={id:'p',timeTargets:{screenMinutes:120,categories:{rest:4200}}};
const data=()=>({profiles:[profile],activities:[{id:'game',profileId:'p',name:'Video games',category:'play'},{id:'draw',profileId:'p',name:'Drawing',category:'play'}],entries:[],goals:[],routines:[]});
const entry=(date,minutes=60,extra={})=>({id:date,profileId:'p',activityId:'game',date,minutes,kind:'actual',...extra});
test('remaining time separates actual from plan and reports excess',()=>{
  const b=timeBalance([{minutes:600}],[{minutes:900}],1);
  assert.equal(b.unknown,840);assert.equal(b.available,540);
  assert.equal(timeBalance([], [{minutes:1600}],1).planOver,160);
});
test('screen tags are independent of category and explicit false overrides name inference',()=>{
  assert.equal(isScreen({name:'Video games'}),true);
  assert.equal(isScreen({name:'Video games',screenTime:false}),false);
  assert.equal(isScreen({name:'Board games',category:'play'}),false);
  assert.equal(isScreen({name:'Homework',screenTime:true}),true);
});
test('weekly flags exclude planned, future, deleted and other profile entries',()=>{
  const d=data();d.entries=[entry('2026-11-09',180),entry('2026-11-09',900,{id:'plan',kind:'plan'}),entry('2026-11-10',900),entry('2026-11-09',900,{id:'other',profileId:'q'}),entry('2026-11-09',900,{id:'del',deleted:true})];
  const s=weeklyInsights(d,profile,'2026-11-09','2026-11-09');
  assert.equal(s.screen,180);assert.equal(s.flags.length,1);assert.match(s.flags[0],/1h above/);assert.equal(s.balance.scheduled,900);
});
test('trends require two matched weeks and do not treat missing days as zero',()=>{
  const d=data();d.entries=[entry('2026-11-09',180),entry('2026-11-02'),entry('2026-10-26')];
  let s=weeklyInsights(d,profile,'2026-11-09','2026-11-09');
  assert.equal(s.baselineCount,2);assert.equal(s.changes[0].delta,120);assert.ok(s.flags.some(f=>f.includes('more recorded than usual')));
  s=weeklyInsights(d,profile,'2026-11-10','2026-11-10');assert.equal(s.changes.length,0);
  s=weeklyInsights(d,profile,'2026-11-16','2026-11-09');assert.equal(s.changes.length,0);assert.equal(s.flags.length,0);
});
test('activity maximum goals flag individually and zero screen limit is supported',()=>{
  const d=data();d.entries=[entry('2026-11-09',60)];d.goals=[{profileId:'p',week:'2026-11-09',activityId:'game',minutes:30,direction:'max'}];
  const s=weeklyInsights(d,{...profile,timeTargets:{screenMinutes:0}},'2026-11-09','2026-11-09');
  assert.equal(s.flags.length,2);assert.match(s.flags[1],/Video games/);
});
