import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Notification backend tests require the Firestore emulator.');
process.env.GCLOUD_PROJECT='demo-dayshape';process.env.DAYSHAPE_SMS_CONFIG='{}';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {getFirestore}=require('firebase-admin/firestore');
const {getApps,deleteApp}=require('firebase-admin/app');
const {notificationSettings,verifyNotificationPhone,detachNotificationDevice}=await import('../../functions/index.js');
const db=getFirestore();
const auth=uid=>({uid,token:{email_verified:true,email:uid+'@example.com'}});
const invoke=(uid,data)=>notificationSettings.run({auth:auth(uid),data});
const recipient={action:'save',profileId:'demo-child',recipientId:'recipient-one',label:'Child iPad',recipientType:'child',timezone:'America/New_York',hour:18,midweek:true,weekly:true,flags:true,consent:true,pushToken:'emulator-only-fake-push-token-never-send',sms:false};
before(async()=>{await db.doc('users/notify-parent').set({familyId:'notify-family'});await db.doc('families/notify-family/members/notify-parent').set({role:'owner'});await db.doc('families/notify-family/records/profiles__demo-child').set({kind:'profiles',value:{id:'demo-child',name:'Demo'}});});
after(async()=>{await Promise.all(getApps().map(app=>deleteApp(app)));});
test('callable refuses unauthenticated, unverified and nonmember users',async()=>{
  await assert.rejects(notificationSettings.run({data:{}}),{code:'unauthenticated'});
  await assert.rejects(notificationSettings.run({auth:{uid:'notify-parent',token:{}},data:{}}),{code:'unauthenticated'});
  await assert.rejects(invoke('outsider',{action:'list',profileId:'demo-child'}),{code:'permission-denied'});
});
test('recipient creation requires consent, live profile, channel and phone verification',async()=>{
  await assert.rejects(invoke('notify-parent',{...recipient,consent:false}),{code:'failed-precondition'});
  await assert.rejects(invoke('notify-parent',{...recipient,profileId:'missing'}),{code:'not-found'});
  await assert.rejects(invoke('notify-parent',{...recipient,pushToken:null}),{code:'invalid-argument'});
  await assert.rejects(invoke('notify-parent',{...recipient,pushToken:null,sms:true,phone:'+15551234567'}),{code:'failed-precondition'});
  await assert.rejects(verifyNotificationPhone.run({auth:auth('notify-parent'),data:{action:'send',phone:'+15551234567',consent:true}}),{code:'failed-precondition'});
});
test('own recipient listing masks tokens and stopping requires ownership',async()=>{
  await invoke('notify-parent',recipient);const list=await invoke('notify-parent',{action:'list',profileId:'demo-child'});
  assert.equal(list.smsReady,false);assert.equal(list.recipients.length,1);assert.equal(list.recipients[0].recipientType,'child');assert.equal(list.recipients[0].pushToken,undefined);
  await db.doc('users/notify-other').set({familyId:'notify-family'});await db.doc('families/notify-family/members/notify-other').set({role:'parent'});
  await assert.rejects(invoke('notify-other',{action:'remove',profileId:'demo-child',id:list.recipients[0].id}),{code:'permission-denied'});
  await detachNotificationDevice.run({auth:auth('notify-other'),data:{token:recipient.pushToken}});
  assert.equal((await invoke('notify-parent',{action:'list',profileId:'demo-child'})).recipients[0].push,true);
  await detachNotificationDevice.run({auth:auth('notify-parent'),data:{token:recipient.pushToken}});
  assert.equal((await invoke('notify-parent',{action:'list',profileId:'demo-child'})).recipients[0].push,false);
  await invoke('notify-parent',{action:'remove',profileId:'demo-child',id:list.recipients[0].id});
  assert.equal((await invoke('notify-parent',{action:'list',profileId:'demo-child'})).recipients.length,0);
});
test('revoked membership prevents managing reminders',async()=>{
  await db.doc('families/notify-family/members/notify-other').delete();
  await assert.rejects(invoke('notify-other',{action:'list',profileId:'demo-child'}),{code:'permission-denied'});
});
