import {dateKey,live,validateMinutes} from './domain.js';
export function scheduleMinutes(start,end){
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))throw Error('Choose start and end times.');
  const parse=t=>{const [h,m]=t.split(':').map(Number);if(h>23||m>59)throw Error('Choose valid times.');return h*60+m;};
  const minutes=(parse(end)-parse(start)+1440)%1440;
  if(!minutes)throw Error('Start and end times must be different.');return minutes;
}
export function completePlan(data,plan,today=dateKey(),updatedAt=new Date().toISOString()){
  if(!plan||plan.deleted||plan.kind!=='plan')throw Error('This plan is no longer available.');
  if(plan.date>today)throw Error('Future plans can be recorded on the day they happen.');
  const id='done:'+plan.id;
  if(live(data.entries).some(e=>e.id===id||e.sourcePlanId===plan.id))return data;
  const others=live(data.entries).filter(e=>e.profileId===plan.profileId&&e.date===plan.date&&e.kind==='actual');
  if(others.some(e=>e.activityId===plan.activityId&&!e.sourcePlanId))throw Error('This activity already has manually logged time today. Edit that entry to avoid counting it twice.');
  if(!validateMinutes(plan.minutes,others))throw Error('This would put recorded time over 24 hours. Review today’s entries first.');
  const record={id,sourcePlanId:plan.id,profileId:plan.profileId,activityId:plan.activityId,date:plan.date,minutes:plan.minutes,kind:'actual',updatedAt};
  return {...data,entries:[...data.entries.filter(e=>e.id!==id),record]};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function routineModal({getData,profileId,date,modal,close,save,toast}){
  const activities=live(getData().activities).filter(a=>a.profileId===profileId);
  modal(`<div class="eyebrow">SET IT ONCE</div><h2>A rhythm for your week</h2><p>Repeating schedules add planned time. Confirm what happened when the day arrives.</p><div class="routine-presets"><button type="button" class="secondary" data-preset="school">School · Mon–Fri</button><button type="button" class="secondary" data-preset="sleep">Sleep · daily</button><button type="button" class="secondary" data-preset="practice">Practice · choose days</button></div><form id="routine-form"><label>Activity<select name="activity">${activities.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><div class="form-row"><label>Starts at<input name="startTime" type="time" value="08:00" required></label><label>Ends at<input name="endTime" type="time" value="15:30" required></label></div><p class="fine">An end time before the start means overnight. Its full duration is assigned to the starting date.</p><fieldset><legend>Repeat on</legend><div class="routine-days">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<label><input type="checkbox" name="days" value="${i}" ${i>0&&i<6?'checked':''}>${d}</label>`).join('')}</div></fieldset><div class="form-row"><label>First date<input name="startDate" type="date" value="${date}" required></label><label>Last date (optional)<input name="endDate" type="date"></label></div><p class="fine">For a holiday, open that day’s plan and remove just that occurrence. You can also stop a repeating plan there.</p><p id="routine-error" class="form-error" role="alert"></p><button class="primary full">Save repeating schedule</button></form>`);
  const form=document.querySelector('#routine-form');
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{
    const type=b.dataset.preset,a=activities.find(a=>new RegExp(type==='practice'?'practice|train':type,'i').test(a.name));if(a)form.elements.activity.value=a.id;
    form.elements.startTime.value=type==='sleep'?'20:30':type==='school'?'08:00':'16:00';form.elements.endTime.value=type==='sleep'?'07:00':type==='school'?'15:30':'17:00';
    form.querySelectorAll('[name=days]').forEach(el=>el.checked=type==='sleep'||(type==='school'&&Number(el.value)>0&&Number(el.value)<6));
  });
  form.onsubmit=e=>{e.preventDefault();try{
    const values=new FormData(form),days=values.getAll('days').map(Number),startDate=values.get('startDate'),endDate=values.get('endDate'),activityId=values.get('activity');
    if(!days.length)throw Error('Choose at least one weekday.');
    if(endDate&&endDate<startDate)throw Error('The last date must be on or after the first date.');
    const latest=getData();if(!live(latest.profiles).some(p=>p.id===profileId)||!live(latest.activities).some(a=>a.id===activityId&&a.profileId===profileId))throw Error('This profile or activity was removed. Reopen schedules.');
    const minutes=scheduleMinutes(values.get('startTime'),values.get('endTime'));
    if(live(latest.routines).some(r=>r.profileId===profileId&&r.activityId===activityId&&(!r.endDate||r.endDate>=startDate)&&(!endDate||r.startDate<=endDate)&&r.days.some(d=>days.includes(d))))throw Error('This activity already repeats on one of those days. Stop the existing schedule first, or choose different days.');
    const routine={id:crypto.randomUUID(),profileId,activityId,minutes,days,startDate,startTime:values.get('startTime'),endTime:values.get('endTime'),updatedAt:new Date().toISOString(),...(endDate?{endDate}:{})};
    save({...latest,routines:[...latest.routines,routine]});close();toast('Repeating plan saved. Confirm actual time after it happens.');
  }catch(error){document.querySelector('#routine-error').textContent=error.message;}};
}
