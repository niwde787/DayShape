import {accountPanel,accessRows} from './account-panel.js';
import {configured, friendlyError} from './cloud.js';
import {createWeeklyEmailUI} from './weekly-email-ui.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createAccountUI({cloud,getState,getLocal,modal,close,toast,exportData,getData=()=>({profiles:[]}),openProfile,editProfile,removeProfile,addProfile,openReminders}) {
  let authMode='login',section='overview',generation=0,accountId=null;
  const reportModal=html=>modal(html+button('← Back to control panel','back','quiet full'));
  const weeklyEmail=createWeeklyEmailUI({cloud,getState,modal:reportModal,toast});
  const button=(text,action,style='secondary full')=>`<button type="button" class="${style}" data-account="${action}">${text}</button>`;
  function show() {
    const state=getState(),ticket=++generation;
    if(accountId!==state.user?.uid){section='overview';accountId=state.user?.uid;}
    let body='';
    if(!configured) {
      body=`<div class="eyebrow">CLOUD SAVING IS NEXT</div><h2>One family. Every device.</h2><p>Firebase is ready to connect, but the app owner still needs to finish setup. Your existing profiles continue saving on this device.</p><a class="primary full" href="./firebase-setup.html" target="_blank" rel="noopener">View setup instructions ↗</a>`;
    } else if(!state.user) {
      body=`<div class="eyebrow">YOUR FAMILY, CONNECTED</div><h2>${authMode==='register'?'Create your parent account':'Welcome back.'}</h2><p>Sign in on any device to open your family’s profiles. Children can use a profile without an email account.</p><div class="segmented">${button('Sign in','login-tab',authMode==='login'?'selected':'')}${button('Create account','register-tab',authMode==='register'?'selected':'')}</div><form id="account-auth"><label>Email<input type="email" name="email" required autocomplete="email" maxlength="254"></label><label>Password<input type="password" name="password" required minlength="${authMode==='register'?10:1}" autocomplete="${authMode==='register'?'new-password':'current-password'}"></label>${authMode==='register'?'<p class="fine">Use at least 10 characters. We’ll send an email to verify your address.</p>':''}<p class="form-error" id="account-error" role="alert"></p><button class="primary full">${authMode==='register'?'Create account':'Sign in'} ↗</button></form>${button('Forgot your password?','reset','quiet full')}<p class="fine account-note">Use your own trusted device. Your session stays signed in until you sign out.</p>`;
    } else if(!state.user.emailVerified) {
      body=`<div class="eyebrow">ONE QUICK CHECK</div><h2>Check your inbox.</h2><p>Verify <strong>${esc(state.user.email)}</strong> using the email from DayShape, then come back here. This protects your family space.</p>${button('I’ve verified my email','verify','primary full')}${button('Send verification email again','resend')}${button('Sign out','logout','quiet full')}`;
    } else if(state.loading) {
      body='<h2>Opening your family space…</h2><p>Checking your account and saved profiles.</p>';
    } else if(!state.family) {
      body=`<div class="eyebrow">YOUR FAMILY’S SPACE</div><h2>Bring your days together.</h2><p>Signed in as ${esc(state.user.email)}.</p>${state.error?`<p class="form-error">${esc(state.error)}</p>${button('Try loading again','retry')}`:''}<form id="create-family"><label>Start a new family space<input name="name" placeholder="e.g. Our family" maxlength="60" required></label><button class="primary full">Create family space ↗</button></form><hr><form id="join-family"><label>Already invited? Enter your family code<input name="code" placeholder="Code shared by the family owner" required maxlength="128" autocomplete="off"></label><p class="fine">The owner must invite ${esc(state.user.email)} first. If your spouse already created a space, join theirs instead of creating another.</p><button class="secondary full">Join family</button></form>${button('Sign out','logout','quiet full')}`;
    } else {
      let local;try{local=getLocal();}catch{local={profiles:[]};}
      modal(accountPanel({state,data:getData(),local,section}));bindForms();
      if(section==='access')cloud.accessList().then(list=>{
        const target=document.querySelector('#panel-access-list');
        if(ticket===generation&&getState().user?.uid===state.user.uid&&getState().family?.id===state.family.id&&target)target.innerHTML=accessRows(list,state);
      }).catch(error=>{const target=document.querySelector('#panel-access-list');if(ticket===generation&&target)target.textContent=friendlyError(error);});
      return;
    }
    modal(`${body}<div id="account-message" role="status"></div><hr><h3>Keep a copy</h3><p class="fine">Download a backup of the profiles currently open.</p>${button('↓ Export backup','export')}`);
    bindForms();
  }
  async function run(action,{refresh=true}={}) {
    const dialog=document.querySelector('#modal');
    dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {await action();if(refresh)show();}
    catch(error){const target=document.querySelector('#account-error')||document.querySelector('#account-message');if(target){target.className='form-error';target.textContent=friendlyError(error);}else toast(friendlyError(error));}
    finally {dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function bindForms() {
    const form=(id,handler)=>{const el=document.getElementById(id);if(el)el.onsubmit=e=>{e.preventDefault();const values=new FormData(el);run(()=>handler(values));};};
    form('account-auth',async f=>{if(authMode==='register')await cloud.register(f.get('email'),f.get('password'));else await cloud.login(f.get('email'),f.get('password'));});
    form('create-family',async f=>{await cloud.createFamily(f.get('name'));close();toast('Your family space is ready.');});
    form('join-family',async f=>{await cloud.joinFamily(f.get('code'));close();toast('You’re part of the family.');});
    form('invite-parent',async f=>{await cloud.invite(f.get('email'));toast('Invitation created for 7 days. Share your family code with them.');});
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('button');if(!el)return;
    if(el.dataset.removeMember){
      const state=getState(),uid=el.dataset.removeMember;if(state.family?.ownerId!==state.user?.uid||uid===state.user.uid)return;
      const email=el.closest('.access-list>div')?.querySelector('span')?.firstChild?.textContent||'this parent';
      modal('<h2>Remove parent access?</h2><p>'+esc(email)+'</p><p>This stops future access to the shared family. It does not remove family profiles or erase previously downloaded copies.</p>'+button('Keep access','back')+'<button class="danger full" id="confirm-parent-removal">Remove access</button><div id="account-message" role="status"></div>');
      document.querySelector('#confirm-parent-removal').onclick=()=>run(async()=>{if(getState().user?.uid!==state.user.uid||getState().family?.id!==state.family.id)throw Error('Your account changed. Reopen access settings.');await cloud.removeMember(uid);});return;}
    if(el.dataset.revokeInvite){run(async()=>{await cloud.revokeInvite(el.dataset.revokeInvite);});return;}
    if(el.dataset.panelProfile){openProfile?.(el.dataset.panelProfile);return;}if(el.dataset.panelEdit){editProfile?.(el.dataset.panelEdit,show);return;}if(el.dataset.panelRemove){removeProfile?.(el.dataset.panelRemove);return;}if(el.dataset.panelReminder){openReminders?.(el.dataset.panelReminder);return;}const action=el.dataset.account;if(!action)return;
    if(action.startsWith('section-')){section=action.slice(8);show();return;}
    if(action==='add-profile'){addProfile?.();return;}
    if(action==='reset-current'){run(async()=>{await cloud.resetPassword(getState().user.email);toast('Password reset email sent. Check your inbox.');});return;}
    if(action==='login-tab'||action==='register-tab'){authMode=action==='login-tab'?'login':'register';show();}
    else if(action==='back')show();
    else if(action==='weekly-email')weeklyEmail.show();
    else if(action==='export')exportData();
    else if(action==='logout')run(()=>cloud.logout());
    else if(action==='verify')run(()=>cloud.refreshVerification());
    else if(action==='resend')run(async()=>{await cloud.resendVerification();toast('Verification email sent. Check your inbox and spam folder.');});
    else if(action==='retry')run(()=>cloud.loadAccount(cloud.user));
    else if(action==='sync')run(()=>cloud.flush());
    else if(action==='import')run(async()=>{cloud.importLocal(getLocal());toast('Device profiles imported. Cloud saving is in progress.');});
    else if(action==='copy-code')run(async()=>{await navigator.clipboard.writeText(getState().family.id);toast('Family code copied.');},{refresh:false});
    else if(action==='reset') {
      const email=document.querySelector('#account-auth [name=email]');
      if(!email?.value||!email.checkValidity()){toast('Enter your email above, then tap Forgot your password.');return;}
      run(async()=>{await cloud.resetPassword(email.value);toast('If an account matches, you’ll receive a password reset email.');},{refresh:false});
    }
  });
  return {show};
}
