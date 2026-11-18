import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleMinutes,completePlan,routineModal} from '../routines.js';
import {routineEntries} from '../domain.js';
import {previousWeekComparison,previousWeekView} from '../insights.js';
import {Window} from 'happy-dom';
const p={id:'p'},plan={id:'r:2026-11-18',profileId:'p',activityId:'school',kind:'plan',date:'2026-11-18',minutes:450};
test('previous full week includes Thursday through Sunday when current week is Wednesday',()=>{
  const data={activities:[{id:'school',profileId:'p',name:'School'}],entries:[{...plan,id:'last-thursday',date:'2026-11-12',kind:'actual',minutes:450},{...plan,id:'last-sunday',date:'2026-11-15',kind:'actual',minutes:60}]};
  const c=previousWeekComparison(data,p,'2026-11-18','2026-11-18');assert.equal(c.rows[0].previous,0);assert.equal(c.rows[0].previousFull,510);assert.equal(c.previousFullCoverage,2);
  const html=previousWeekView(data,p,'2026-11-18','2026-11-18');assert.match(html,/8h 30m/);assert.match(html,/2026-11-09 – 2026-11-15/);assert.match(html,/No entries/);assert.match(html,/Week not finished/);assert.doesNotMatch(html,/↓/);
});
test('comparison dates cross year boundaries and filter plans, deleted entries and other profiles',()=>{
  const base={...plan,kind:'actual',date:'2026-12-31'};
  const data={activities:[],entries:[base,{...base,id:'plan',kind:'plan',minutes:999},{...base,id:'deleted',deleted:true,minutes:999},{...base,id:'other',profileId:'other',minutes:999}]};
  const c=previousWeekComparison(data,p,'2027-01-06','2027-01-06');assert.equal(c.previousFullDates[0],'2026-12-28');assert.equal(c.previousFullDates[6],'2027-01-03');assert.equal(c.rows[0].previousFull,450);
});
test('school and overnight sleep calculate correct schedule durations',()=>{assert.equal(scheduleMinutes('08:00','15:30'),450);assert.equal(scheduleMinutes('20:30','07:00'),630);assert.throws(()=>scheduleMinutes('08:00','08:00'));assert.throws(()=>scheduleMinutes('25:00','07:00'));});
test('completion retains plan and deduplicates across devices and repeated taps',()=>{
  const data={entries:[],routines:[{id:'r',profileId:'p',activityId:'school',days:[3],startDate:'2026-11-18',minutes:450}]};
  const next=completePlan(data,plan,'2026-11-18');assert.equal(next.entries.length,1);assert.equal(next.entries[0].minutes,450);assert.equal(routineEntries(next,'p','2026-11-18').length,1);assert.equal(completePlan(next,plan,'2026-11-18'),next);assert.equal(completePlan(data,plan,'2026-11-18').entries[0].id,next.entries[0].id);
});
test('completion refuses future plans, manual duplicates, and over-capacity days',()=>{
  assert.throws(()=>completePlan({entries:[]},plan,'2026-11-17'),/Future/);
  assert.throws(()=>completePlan({entries:[{...plan,id:'manual',kind:'actual'}]},plan,'2026-11-18'),/manually/);
  assert.throws(()=>completePlan({entries:[{...plan,id:'sleep',activityId:'sleep',kind:'actual',minutes:1200}]},plan,'2026-11-18'),/24 hours/);
});
test('last week comparison uses matching weekdays and withholds changes for gaps',()=>{
  const data={activities:[{id:'school',profileId:'p',name:'School'}],entries:[{...plan,kind:'actual'},{...plan,id:'prior',date:'2026-11-11',kind:'actual',minutes:400},{...plan,id:'future',date:'2026-11-19',kind:'actual',minutes:900}]};
  let c=previousWeekComparison(data,p,'2026-11-18','2026-11-18');assert.equal(c.days,3);assert.equal(c.rows[0].current,450);assert.equal(c.rows[0].previous,400);assert.equal(c.comparable,false);
  for(const date of ['2026-11-16','2026-11-17','2026-11-09','2026-11-10'])data.entries.push({...plan,id:date,date,kind:'actual',minutes:100});
  c=previousWeekComparison(data,p,'2026-11-18','2026-11-18');assert.equal(c.comparable,true);assert.equal(c.rows[0].delta,50);
});
test('school shortcut saves weekday schedule with end date; duplicate schedules are rejected',()=>{
  const window=new Window(),old={document:globalThis.document,FormData:globalThis.FormData};globalThis.document=window.document;globalThis.FormData=window.FormData;
  let data={profiles:[p],activities:[{id:'school',profileId:'p',name:'School'}],entries:[],routines:[]};
  try{routineModal({getData:()=>data,profileId:'p',date:'2026-11-18',modal:html=>window.document.body.innerHTML=html,close(){},toast(){},save:next=>data=next});
    window.document.querySelector('[data-preset=school]').click();const f=window.document.querySelector('form');f.elements.endDate.value='2027-06-01';f.onsubmit({preventDefault(){}});assert.equal(data.routines.length,1);assert.deepEqual(data.routines[0].days,[1,2,3,4,5]);assert.equal(data.routines[0].minutes,450);assert.equal(data.routines[0].endDate,'2027-06-01');f.onsubmit({preventDefault(){}});assert.equal(data.routines.length,1);assert.match(window.document.querySelector('#routine-error').textContent,/already repeats/);
  }finally{window.happyDOM.abort();Object.assign(globalThis,old);}
});
