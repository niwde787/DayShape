export const categories = [
 {id:'rest',name:'Sleep & rest',color:'#aaa4d2',icon:'☾'},
 {id:'learn',name:'Learning & school',color:'#e9bd59',icon:'✎'},
 {id:'move',name:'Exercise & sports',color:'#8bb29d',icon:'↗'},
 {id:'play',name:'Entertainment',color:'#ee9979',icon:'▷'},
 {id:'create',name:'Creativity',color:'#d7a5b8',icon:'✳'},
 {id:'family',name:'Family & social',color:'#83b6c8',icon:'♡'},
 {id:'life',name:'Daily essentials',color:'#b3baa0',icon:'⌂'},
 {id:'work',name:'Work',color:'#95a6c4',icon:'▣'}
];
export const defaults=[['Sleep','rest'],['School','learn'],['Practice','move'],['Video games','play'],['Reading','learn'],['Drawing','create'],['Family time','family'],['Meals & getting ready','life'],['Homework','learn'],['Work','work']];
export const uid=()=>crypto.randomUUID();
export function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function shiftDate(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);}
export function weekStart(key){const d=new Date(key+'T12:00:00');return shiftDate(key,-((d.getDay()+6)%7));}
export function rangeDates(key,view){if(view==='day')return [key];let start=view==='week'?weekStart(key):key.slice(0,8)+'01';let end=view==='week'?shiftDate(start,7):dateKey(new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),1));const out=[];while(start<end){out.push(start);start=shiftDate(start,1);}return out;}
export const duration=n=>{n=Math.round(n);return n>=60?`${Math.floor(n/60)}h${n%60?' '+n%60+'m':''}`:`${n}m`;};
export function suggestCategory(name){const s=name.toLowerCase();return /sleep|bed|nap|rest/.test(s)?'rest':/school|homework|read|study|learn/.test(s)?'learn':/practice|train|basket|soccer|football|swim|run|walk|bike|sport|gym/.test(s)?'move':/game|gaming|tv|movie|video/.test(s)?'play':/draw|paint|music|piano|craft|art/.test(s)?'create':/family|friend|visit|party/.test(s)?'family':/work|meeting|office/.test(s)?'work':'life';}
export function mergeRecords(a,b){const m=new Map();for(const r of [...a,...b]){const old=m.get(r.id);if(!old||r.updatedAt>old.updatedAt||(r.updatedAt===old.updatedAt&&JSON.stringify(r)>JSON.stringify(old)))m.set(r.id,r);}return [...m.values()];}
export function mergeData(a,b){const out={version:1};for(const k of ['profiles','activities','entries','goals','routines'])out[k]=mergeRecords(a[k]||[],b[k]||[]);return out;}
export const live=a=>(a||[]).filter(x=>!x.deleted);
export function totals(entries){return entries.reduce((n,e)=>n+e.minutes,0);}
export function validateMinutes(value,others){return Number.isInteger(value)&&value>0&&value<=1440&&totals(others)+value<=1440;}
export function routineEntries(data,profileId,date){const weekday=new Date(date+'T12:00:00').getDay();return live(data.routines).filter(r=>r.profileId===profileId&&r.days.includes(weekday)&&date>=r.startDate&&(!r.endDate||date<=r.endDate)).filter(r=>!data.entries.some(e=>e.routineId===r.id&&e.date===date)).map(r=>({...r,id:`${r.id}:${date}`,routineId:r.id,date,kind:'plan',virtual:true}));}
