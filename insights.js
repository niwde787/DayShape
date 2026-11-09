import {categories, dateKey, rangeDates, shiftDate, live, totals, duration, routineEntries} from './domain.js';

// A tag is independent of category: leisure is not necessarily screen time.
export function isScreen(activity) {
  return typeof activity?.screenTime === 'boolean' ? activity.screenTime : /\b(video games?|gaming|screen time|tv|television|youtube|tiktok|social media)\b/i.test(activity?.name || '');
}
export function timeBalance(actual, planned, days) {
  const capacity=days*1440, recorded=totals(actual), scheduled=totals(planned);
  return {capacity,recorded,scheduled,unknown:Math.max(0,capacity-recorded),available:Math.max(0,capacity-scheduled),actualOver:Math.max(0,recorded-capacity),planOver:Math.max(0,scheduled-capacity)};
}
export function weeklyInsights(data, profile, selected, today=dateKey()) {
  const dates=rangeDates(selected,'week'), start=dates[0];
  const activities=data.activities.filter(a=>a.profileId===profile.id);
  const byId=new Map(activities.map(a=>[a.id,a]));
  const all=live(data.entries).filter(e=>e.profileId===profile.id&&e.kind==='actual'&&e.date<=today);
  const actual=all.filter(e=>dates.includes(e.date));
  const planned=[...live(data.entries).filter(e=>e.profileId===profile.id&&e.kind==='plan'&&dates.includes(e.date)),...dates.flatMap(d=>routineEntries(data,profile.id,d))];
  const screenTotal=rows=>totals(rows.filter(e=>isScreen(byId.get(e.activityId))));
  const screen=screenTotal(actual), limit=profile.timeTargets?.screenMinutes;
  const flags=[];
  if(Number.isFinite(limit)&&limit>=0&&screen>limit) flags.push(`Screen time is ${duration(screen-limit)} above your ${duration(limit)} weekly limit.`);
  for(const goal of live(data.goals).filter(g=>g.profileId===profile.id&&g.week===start&&g.direction==='max')) {
    const n=totals(actual.filter(e=>e.activityId===goal.activityId));
    if(n>goal.minutes) flags.push(`${byId.get(goal.activityId)?.name||'Activity'} is ${duration(n-goal.minutes)} above its weekly goal.`);
  }
  const days=dates.filter(d=>d<=today), covered=days.filter(d=>actual.some(e=>e.date===d));
  // Compare the same weekdays, requiring entries on every compared day.
  // A blank day is unknown, never an observed zero.
  const baseline=[];
  if(days.length&&covered.length===days.length) for(let back=1;back<=4;back++) {
    const previousDates=days.map(d=>shiftDate(d,-7*back));
    const rows=all.filter(e=>previousDates.includes(e.date));
    if(previousDates.every(d=>rows.some(e=>e.date===d))) baseline.push(rows);
  }
  const measures=[{name:'Screen time',sum:screenTotal},...activities.filter(a=>!a.deleted).map(a=>({name:a.name,sum:rows=>totals(rows.filter(e=>e.activityId===a.id))}))];
  const changes=baseline.length>=2?measures.map(m=>{
    const current=m.sum(actual), average=baseline.reduce((n,rows)=>n+m.sum(rows),0)/baseline.length;
    return {name:m.name,current,average,delta:current-average};
  }).filter(m=>m.current||m.average):[];
  for(const m of changes) if(m.delta>=60&&m.current>m.average*1.5) flags.push(`${m.name}: ${duration(m.delta)} more recorded than usual for these weekdays (${baseline.length}-week average).`);
  const weeks=Array.from({length:4},(_,i)=>{
    const week=shiftDate(start,(i-3)*7), weekDates=rangeDates(week,'week'), rows=all.filter(e=>weekDates.includes(e.date));
    return {start:week,total:totals(rows),screen:screenTotal(rows),coverage:new Set(rows.map(e=>e.date)).size,partial:shiftDate(week,6)>=today};
  });
  return {start,dates,actual,planned,screen,limit,flags,changes,baselineCount:baseline.length,coverage:covered.length,elapsed:days.length,weeks,
    categories:categories.map(c=>({...c,minutes:totals(actual.filter(e=>byId.get(e.activityId)?.category===c.id)),target:profile.timeTargets?.categories?.[c.id]||0})),
    balance:timeBalance(actual,planned,7)};
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
export function remainingView(actual,planned,days) {
  const b=timeBalance(actual,planned,days);
  return `<section class="time-balance" aria-label="Time remaining"><div><span>RECORDED</span><strong>${duration(b.recorded)}</strong><small>of ${duration(b.capacity)}</small></div><div><span>NOT YET RECORDED</span><strong>${duration(b.unknown)}</strong><small>Unknown time, not necessarily free</small></div><div><span>AVAILABLE TO PLAN</span><strong>${duration(b.available)}</strong><small>${duration(b.scheduled)} already planned</small></div>${b.actualOver||b.planOver?`<p class="insight-flag">Check overlapping entries: ${b.actualOver?`${duration(b.actualOver)} recorded over capacity. `:''}${b.planOver?`${duration(b.planOver)} planned over capacity.`:''}</p>`:''}</section>`;
}
export function insightsView(data,profile,date) {
  const s=weeklyInsights(data,profile,date), allocated=s.categories.reduce((n,c)=>n+c.target,0);
  return `<section class="card insights-card"><div class="card-title"><div><div class="eyebrow">NOTICE YOUR PATTERNS</div><h2>Weekly balance & trends</h2><p>${short(s.start)} – ${short(s.dates[6])} · Actual time</p></div><button class="secondary" data-action="time-targets">Targets & screens</button></div>
    <p class="fine">${s.coverage} of ${s.elapsed} elapsed days have entries · ${duration(s.balance.recorded)} recorded out of 168h. Gaps are unknown; logging more can change the trend.</p>
    <div class="screen-summary"><strong>${duration(s.screen)} of screen time</strong><span>${Number.isFinite(s.limit)?s.screen>s.limit?`${duration(s.screen-s.limit)} above your limit`:`${duration(s.limit-s.screen)} left within your ${duration(s.limit)} weekly limit`:'Set a family screen limit to see hours remaining.'}</span></div>
    ${s.flags.length?`<ul class="insight-flags">${s.flags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'<p class="fine">No limits or unusual increases flagged in the recorded time.</p>'}
    <div class="insight-columns"><div><h3>Your weekly distribution</h3><p class="fine">Recorded / chosen weekly target. Targets do not add activities to your calendar.</p>${s.categories.map(c=>`<div class="budget-row"><div><span>${esc(c.name)}</span><b>${duration(c.minutes)} / ${c.target?duration(c.target):'not set'}</b></div><div class="budget-track"><i style="width:${Math.min(100,c.minutes/(c.target||10080)*100)}%;background:${c.color}"></i></div></div>`).join('')}<p class="fine">${duration(allocated)} of 168h assigned to targets · ${duration(Math.max(0,10080-allocated))} left to allocate.</p></div>
    <div><h3>Four weeks at a glance</h3><p class="fine">Bars show recorded time; the darker portion is tagged screen time.</p><div class="week-history">${s.weeks.map(w=>`<div class="history-row"><div><span>${short(w.start)}${w.partial?' · in progress':''}</span><b>${w.coverage?duration(w.total):'No entries'}</b></div><div class="history-track"><i style="width:${Math.min(100,w.total/10080*100)}%"><em style="width:${w.total?Math.min(100,w.screen/w.total*100):0}%"></em></i></div><small>${w.coverage}/7 days logged · ${duration(w.screen)} screens</small></div>`).join('')}</div>
    <h3>Compared with your recent pattern</h3>${s.changes.length?`<p class="fine">Same ${s.elapsed} weekday${s.elapsed===1?'':'s'}, averaged over ${s.baselineCount} prior weeks with entries on every compared day. Today may still be incomplete.</p><div class="trend-list">${s.changes.map(m=>`<div><span>${esc(m.name)}</span><b>${Math.abs(m.delta)<1?'About the same':`${duration(Math.abs(m.delta))} ${m.delta>0?'more':'less'}`}</b></div>`).join('')}</div>`:'<p class="fine">Keep logging to build a comparison. We need entries for every elapsed weekday here and the matching weekdays in at least two of the last four weeks.</p>'}
    <p class="fine">An increase is flagged at more than 50% and at least 1 hour above the recent average. These are conversation starters, not health judgments.</p></div></div>
    <details class="time-guidance"><summary>About balanced time & the example</summary><p>The pictured example is one weekday: 8.5h sleep, 7h school, 4h leisure, 2.5h sports, and 2h essentials. Weekends will look different, and leisure is not all screen time.</p><p>For ages 6–12, sleep guidance is 9–12 hours each day; ages 13–17 need 8–10 hours. The example’s 8.5h is below the range for a 12-year-old. <a href="https://www.cdc.gov/sleep/about/" target="_blank" rel="noopener">CDC sleep guidance</a>.</p><p>Choose weekly targets together and adapt them to school, rest, and your family’s routine. Use a <a href="https://www.healthychildren.org/English/family-life/Media/Pages/How-to-Make-a-Family-Media-Use-Plan.aspx" target="_blank" rel="noopener">family media plan from the AAP</a> for screen habits. Targets here are family choices, not prescribed healthy allocations.</p></details></section>`;
}

export function targetsModal({data,profile,modal,close,changed,getData=()=>data}) {
  const acts=live(data.activities).filter(a=>a.profileId===profile.id), targets=profile.timeTargets||{};
  modal(`<div class="eyebrow">MAKE ROOM TOGETHER</div><h2>Weekly targets & screens</h2><p>Choose a repeatable weekly budget for ${esc(profile.name)}. Leave category targets at zero to keep them unset.</p><form id="time-target-form"><div class="target-fields">${categories.map(c=>`<label>${esc(c.name)} (hours)<input type="number" name="budget-${c.id}" min="0" max="168" step="0.25" value="${Number(targets.categories?.[c.id]||0)/60}"></label>`).join('')}</div><output id="budget-remaining" aria-live="polite"></output><label>Screen limit per week (hours)<input name="screen-limit" type="number" min="0" max="168" step="0.25" placeholder="No limit set" value="${Number.isFinite(targets.screenMinutes)?targets.screenMinutes/60:''}"></label><p class="fine">Blank means no screen limit. Zero means no screen time planned. Screen time is already part of the categories above, so it is not added to the 168h budget again.</p><fieldset><legend>Which activities count as screen time?</legend><p class="fine">Obvious screen activities are suggested. Review these tags; changes apply to past entries too. Schoolwork on a screen can be included or excluded to match your family’s limit.</p>${acts.map(a=>`<label class="screen-choice"><input type="checkbox" name="screen-activity" value="${esc(a.id)}" ${isScreen(a)?'checked':''}>${esc(a.name)}</label>`).join('')}</fieldset><p class="form-error" id="target-error" role="alert"></p><button class="primary full">Save weekly targets</button></form>`);
  const form=document.querySelector('#time-target-form');
  const values=()=>Object.fromEntries(categories.map(c=>[c.id,Number(form.elements[`budget-${c.id}`].value)*60]));
  const update=()=>{const n=Object.values(values()).reduce((n,v)=>n+v,0);document.querySelector('#budget-remaining').textContent=n<=10080?`${duration(10080-n)} of 168h left to allocate`:`${duration(n-10080)} over the 168h weekly budget`;};
  form.addEventListener('input',update);update();
  form.onsubmit=e=>{
    e.preventDefault();const categories=values(), total=Object.values(categories).reduce((n,v)=>n+v,0), raw=form.elements['screen-limit'].value, screenMinutes=raw===''?null:Number(raw)*60;
    if(Object.values(categories).some(n=>!Number.isFinite(n)||n<0)||total>10080||(screenMinutes!==null&&(!Number.isFinite(screenMinutes)||screenMinutes<0||screenMinutes>10080))) {document.querySelector('#target-error').textContent='Keep the category budget within 168 hours and screen limits between 0 and 168 hours.';return;}
    const latest=getData(), current=live(latest.profiles).find(p=>p.id===profile.id);
    if(!current){document.querySelector('#target-error').textContent='This profile was removed on another device. Close this window to continue.';return;}
    const now=new Date().toISOString();current.timeTargets={categories,screenMinutes};current.updatedAt=now;
    const tagged=new Set(new FormData(form).getAll('screen-activity'));
    const shown=new Set(acts.map(a=>a.id));
    for(const a of live(latest.activities).filter(a=>a.profileId===profile.id&&shown.has(a.id))) if(a.screenTime!==tagged.has(a.id)){a.screenTime=tagged.has(a.id);a.updatedAt=now;}
    close();changed();
  };
}
