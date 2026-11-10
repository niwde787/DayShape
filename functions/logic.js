export const shift=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const monday=date=>shift(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
export function localClock(now,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};}
export function validateRecipient(input){
  if(!input||typeof input!=='object')throw Error('Choose your reminder settings.');
  const label=String(input.label||'').trim();if(!label||label.length>40)throw Error('Use a recipient name up to 40 characters.');
  if(!['parent','child'].includes(input.recipientType))throw Error('Choose parent or child.');
  const timezone=String(input.timezone||'');try{localClock(new Date(),timezone);}catch{throw Error('Choose a valid time zone.');}
  const hour=Number(input.hour);if(!Number.isInteger(hour)||hour<8||hour>20)throw Error('Choose an update hour from 8am to 8pm.');
  return {label,recipientType:input.recipientType,timezone,hour,midweek:input.midweek===true,weekly:input.weekly===true,flags:input.flags===true};
}
const hours=n=>`${Math.round(n/6)/10}h`;
export function report(records,profileId,start,end){
  const data=records.filter(r=>!r.value?.deleted),profile=data.find(r=>r.kind==='profiles'&&r.value.id===profileId)?.value;
  if(!profile)return null;
  const rows=data.filter(r=>r.kind==='entries'&&r.value.profileId===profileId&&r.value.kind==='actual'&&r.value.date>=start&&r.value.date<=end).map(r=>r.value);
  const activities=new Map(data.filter(r=>r.kind==='activities'&&r.value.profileId===profileId).map(r=>[r.value.id,r.value]));
  const sum=rows=>rows.reduce((n,e)=>n+e.minutes,0),screen=sum(rows.filter(e=>{const a=activities.get(e.activityId);return typeof a?.screenTime==='boolean'?a.screenTime:/\b(video games?|gaming|screen time|tv|television|youtube|tiktok|social media)\b/i.test(a?.name||'');}));
  const flags=[],limit=profile.timeTargets?.screenMinutes;
  if(Number.isFinite(limit)&&screen>limit)flags.push(`screen time ${hours(screen-limit)} above your weekly limit`);
  for(const {value:g} of data.filter(r=>r.kind==='goals'&&r.value.profileId===profileId&&r.value.week===start&&r.value.direction==='max')){const spent=sum(rows.filter(e=>e.activityId===g.activityId));if(spent>g.minutes)flags.push(`${activities.get(g.activityId)?.name||'Activity'} ${hours(spent-g.minutes)} above its goal`);}
  return {name:String(profile.name||'Profile').replace(/[\r\n]/g,' ').slice(0,30),total:sum(rows),screen,days:new Set(rows.map(e=>e.date)).size,flags};
}
export function dueMessages(subscription,records,now=new Date()){
  const {date,hour}=localClock(now,subscription.timezone),weekday=new Date(date+'T12:00:00Z').getUTCDay(),week=monday(date),out=[];
  if(hour<8||hour>=21)return out;
  const add=(type,start,end)=>{const r=report(records,subscription.profileId,start,end);if(!r||!r.days||(type==='flags'&&!r.flags.length))return;
    const heading=type==='midweek'?'Midweek check-in':type==='weekly'?'Weekly recap':'Time to check in';
    const summary=type==='flags'?r.flags.slice(0,2).join('; '):`${hours(r.total)} recorded across ${r.days} days; ${hours(r.screen)} screens. Unlogged time is unknown.`;
    out.push({key:`${start}-${type}`,type,title:`DayShape: ${heading}`,body:`${r.name}: ${summary}`});};
  if(subscription.midweek&&weekday===3&&hour===subscription.hour)add('midweek',week,date);
  if(subscription.weekly&&weekday===1&&hour===subscription.hour)add('weekly',shift(week,-7),shift(week,-1));
  if(subscription.flags)add('flags',week,date);
  return out;
}
