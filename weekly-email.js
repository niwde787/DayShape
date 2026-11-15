import {weeklyInsights} from './insights.js';
import {live,duration,shiftDate} from './domain.js';
import {localClock,monday,shift} from './functions/logic.js';

export const REPORT_TIMEZONE='America/New_York';
export const APP_URL='https://niwde787.github.io/DayShape/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportWindow(now=new Date()) {
  const {date,hour}=localClock(now,REPORT_TIMEZONE),start=shift(monday(date),-7);
  return {start,end:shift(start,6),due:new Date(date+'T12:00:00Z').getUTCDay()===1&&hour>=9&&hour<21};
}
export function eligibleEmail(preference,account,userLink,isMember) {
  return preference?.enabled===true&&preference.consentVersion===1&&isMember===true&&
    account?.emailVerified===true&&!account.disabled&&typeof account.email==='string'&&
    account.email.toLowerCase()===preference.email&&userLink?.familyId===preference.familyId;
}
export function buildWeeklyEmail(data,start) {
  const end=shiftDate(start,6),lines=[`Your DayShape week: ${start} – ${end}`,''];
  const sections=live(data.profiles).map(profile=>{
    const s=weeklyInsights(data,profile,start,end);
    const activities=new Map(data.activities.filter(a=>a.profileId===profile.id).map(a=>[a.id,a.name]));
    const totals=new Map();for(const e of s.actual)totals.set(e.activityId,(totals.get(e.activityId)||0)+e.minutes);
    const activityLines=[...totals].sort((a,b)=>b[1]-a[1]).map(([id,n])=>`${activities.get(id)||'Removed activity'}: ${duration(n)}`);
    const goals=live(data.goals).filter(g=>g.profileId===profile.id&&g.week===start).map(g=>{
      const spent=totals.get(g.activityId)||0,met=g.direction==='max'?spent<=g.minutes:spent>=g.minutes;
      return `${activities.get(g.activityId)||'Activity'}: ${duration(spent)} recorded / ${g.direction==='max'?'maximum':'target'} ${duration(g.minutes)}${s.coverage===7?(met?' · goal met':' · keep working together'):' · incomplete logging'}`;
    });
    const summary=s.coverage?`${duration(s.balance.recorded)} recorded · ${s.coverage}/7 days logged · ${duration(s.screen)} screen time`:'No time was logged this week.';
    const gaps=`${duration(s.balance.unknown)} not recorded out of 168h. Unlogged time is unknown, not necessarily free.${s.balance.actualOver?' Recorded time exceeds 168h; check overlapping entries.':''}`;
    const flags=s.flags.length?s.flags:['No limits or unusual increases flagged in the recorded time.'];
    const categories=s.categories.filter(c=>c.minutes||c.target).map(c=>`${c.name}: ${duration(c.minutes)}${c.target?' / target '+duration(c.target):''}`);
    lines.push(profile.name,summary,gaps,...activityLines,...categories,...goals,...flags,'');
    const list=items=>`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    return `<section style="padding:20px 0;border-bottom:1px solid #ddd"><h2>${esc(profile.name)}</h2><p><strong>${esc(summary)}</strong></p><p>${esc(gaps)}</p>${activityLines.length?'<h3>Activities</h3>'+list(activityLines):''}${categories.length?'<h3>Weekly distribution</h3>'+list(categories):''}${goals.length?'<h3>Your goals</h3>'+list(goals):''}<h3>Things to notice</h3>${list(flags)}</section>`;
  });
  if(!sections.length)return null;
  const footer='Choose one small change together for the coming week. These are recorded totals, not health judgments. Manage or stop weekly emails in DayShape → Account → Weekly email report.';
  lines.push(footer,APP_URL);
  return {subject:`DayShape weekly report · ${start} – ${end}`,text:lines.join('\n'),html:`<!doctype html><html lang="en"><body style="margin:0;background:#f6f4ee;color:#243b35;font:16px Arial,sans-serif"><main style="max-width:620px;margin:auto;padding:24px"><h1>Your week, together.</h1><p>${esc(start)} – ${esc(end)} · DayShape</p>${sections.join('')}<p>${esc(footer)}</p><p><a href="${APP_URL}">Open DayShape and manage reports</a></p></main></body></html>`};
}
