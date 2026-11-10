import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createNotificationUI} from '../notification-ui.js';
test('profile reminders require a parent account and can save a child push recipient without collecting SMS numbers',async()=>{
  const window=new Window(),old={};for(const [key,value] of Object.entries({document:window.document,FormData:window.FormData})){old[key]=globalThis[key];globalThis[key]=value;}
  const calls=[];let signedIn=false;
  try{
    const ui=createNotificationUI({getState:()=>signedIn?{user:{uid:'parent',emailVerified:true},family:{id:'f'}}:{},modal:html=>window.document.body.innerHTML=html,toast:()=>{},enablePush:async()=>'test-push-token',call:async(name,data)=>{calls.push({name,data});return {smsReady:false,recipients:[]};}});
    await ui.show({id:'p',name:'Alex'});assert.match(window.document.body.textContent,/verified parent account/);assert.equal(calls.length,0);
    signedIn=true;await ui.show({id:'p',name:'Alex'});window.document.querySelector('#add-recipient').click();
    const form=window.document.querySelector('#recipient-form');assert.equal(form.elements.sms.disabled,true);assert.equal(form.elements.phone,undefined);
    form.elements.label.value='Alex’s iPad';form.elements.recipientType.value='child';form.elements.consent.checked=true;
    window.document.querySelector('#enable-push').click();await new Promise(r=>setTimeout(r,10));
    form.dispatchEvent(new window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
    const saved=calls.find(c=>c.data.action==='save');assert.ok(saved);assert.equal(saved.data.recipientType,'child');assert.equal(saved.data.pushToken,'test-push-token');assert.equal(saved.data.sms,false);assert.equal(saved.data.profileId,'p');assert.equal(saved.data.midweek,true);assert.equal(saved.data.weekly,true);
  }finally{window.happyDOM.abort();for(const key of Object.keys(old)){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}}
});
