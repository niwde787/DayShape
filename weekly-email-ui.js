const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createWeeklyEmailUI({cloud,getState,modal,toast}) {
  let generation=0;
  async function show(){
    const ticket=++generation,state=getState();
    if(!state.user?.emailVerified||!state.family){toast('Sign in with a verified parent account and open your family first.');return;}
    modal('<h2>Weekly email report</h2><p id="weekly-email-loading">Loading your settings…</p>');
    try {
      const {preference,service}=await cloud.weeklyEmailSettings();
      if(ticket!==generation||getState().user?.uid!==state.user.uid||!document.querySelector('#weekly-email-loading'))return;
      modal(`<div class="eyebrow">YOUR WEEK, TOGETHER</div><h2>Monday email report</h2><p>One report covering all family profiles for the previous Monday–Sunday: activities, screen time, goals, and time-limit flags.</p><p><strong>To: ${esc(state.user.email)}</strong><br>Monday morning, around 9–10am Eastern time.</p><p class="fine">${service?.enabled?'Email delivery is configured. Delivery time can vary.':'Delivery setup is pending. You can save your preference now, but no reports will be sent until the sender is connected.'}</p><form id="weekly-email-form"><label class="screen-choice"><input type="checkbox" name="enabled" ${preference?.enabled?'checked':''}>Email me the weekly family report</label><p class="fine">Reports include family profile names and activity totals. Turning this on opts your registered email into weekly reports. You can turn it off here at any time. Each parent manages their own subscription.</p><p id="weekly-email-error" role="alert" class="form-error"></p><button class="primary full">Save email preference</button></form>`);
      const form=document.querySelector('#weekly-email-form');
      form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{
        if(getState().user?.uid!==state.user.uid||getState().family?.id!==state.family.id)throw Error('Your account changed. Reopen report settings.');
        await cloud.saveWeeklyEmail(form.elements.enabled.checked);
        toast(form.elements.enabled.checked?(service?.enabled?'Weekly email report enabled.':'Preference saved. Email delivery setup is still pending.'):'Weekly email report turned off.');
      }catch(error){form.querySelector('#weekly-email-error').textContent=error.message;}finally{button.disabled=false;}};
    }catch(error){if(ticket===generation&&document.querySelector('#weekly-email-loading'))modal(`<h2>Weekly email report</h2><p role="alert">${esc(error.message)}</p>`);}
  }
  return {show};
}
