import test from 'node:test';
import assert from 'node:assert/strict';
import {isScreen,timeBalance,weeklyInsights,previousWeekComparison,previousWeekView,targetsModal} from '../insights.js';
import {Window} from 'happy-dom';
const profile={id:'p',timeTargets:{screenMinutes:120,categories:{rest:4200}}};
const data=()=>({profiles:[profile],activities:[{id:'game',profileId:'p',name:'Video games',category:'play'},{id:'draw',profileId:'p',name:'Drawing',category:'play'}],entries:[],goals:[],routines:[]});
const entry=(date,minutes=60,extra={})=>({id:date,profileId:'p',activityId:'game',date,minutes,kind:'actual',...extra});
test('remaining time separates actual from plan and reports excess',()=>{
  const b=timeBalance([{minutes:600}],[{minutes:900}],1);
  assert.equal(b.unknown,840);assert.equal(b.available,540);
  assert.equal(timeBalance([], [{minutes:1600}],1).planOver,160);
});
test('legacy unchecked tags recover automatically; reviewed exclusions override detection',()=>{
  assert.equal(isScreen({name:'Video games'}),true);
  assert.equal(isScreen({name:'Video games',screenTime:false}),true);
  assert.equal(isScreen({name:'Video games',screenTime:false,screenTagVersion:2}),false);
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


test('legacy screen activities contribute to both weeks automatically and exclusions remain editable',()=>{
  const window=new Window(),old={document:globalThis.document,FormData:globalThis.FormData};
  globalThis.document=window.document;globalThis.FormData=window.FormData;
  try {
    const d=data();d.activities=[{id:'game',profileId:'p',name:'Video games',screenTime:false},{id:'phone',profileId:'p',name:'Screen time',screenTime:false},{id:'yt',profileId:'p',name:'YouTube',screenTime:false},{id:'school',profileId:'p',name:'School',screenTime:true}];
    d.entries=[entry('2026-11-23',150),entry('2026-11-23',105,{id:'phone-now',activityId:'phone'}),entry('2026-11-16',907),entry('2026-11-16',1515,{id:'phone-before',activityId:'phone'}),entry('2026-11-16',420,{id:'yt-before',activityId:'yt'})];
    const original=JSON.stringify(d.entries);
    assert.equal(previousWeekComparison(d,profile,'2026-11-23','2026-11-23').rows[1].current,255);
    assert.equal(previousWeekComparison(d,profile,'2026-11-23','2026-11-23').rows[1].previousFull,2842);
    assert.match(previousWeekView(d,profile,'2026-11-23','2026-11-23'),/Video games, Screen time, YouTube, School/);
    let saved=0;
    targetsModal({data:d,profile,modal:html=>window.document.body.innerHTML=html,close(){},changed(){saved++;}});
    window.document.querySelector('#suggest-screen-tags').click();
    assert.ok(window.document.querySelector('[value="school"]').checked,'retain custom screen selections');
    assert.equal(d.activities[0].screenTime,false,'suggestions do not save until submitted');
    window.document.querySelector('#time-target-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    assert.equal(saved,1);assert.equal(d.activities[0].screenTagVersion,2);
    const c=previousWeekComparison(d,profile,'2026-11-23','2026-11-23');
    assert.equal(c.rows[1].name,'Screen time total (tagged activities)');
    assert.equal(c.rows[1].current,255);assert.equal(c.rows[1].previousFull,2842);
    assert.equal(c.rows.find(r=>r.name==='Screen time').current,105);
    assert.equal(weeklyInsights(d,profile,'2026-11-23','2026-11-23').screen,255);
    assert.equal(JSON.stringify(d.entries),original);
    assert.doesNotMatch(previousWeekView(d,profile,'2026-11-23','2026-11-23'),/Excluded from screen totals:/);
    window.document.querySelector('[value=game]').checked=false;
    window.document.querySelector('#time-target-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    assert.equal(previousWeekComparison(d,profile,'2026-11-23','2026-11-23').rows[1].current,105);
    assert.equal(isScreen(JSON.parse(JSON.stringify(d.activities[0]))),false,'reviewed exclusion survives reload');
  } finally {window.happyDOM.abort();globalThis.document=old.document;globalThis.FormData=old.FormData;}
});
