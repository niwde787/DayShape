import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {accountPanel,accessRows} from '../account-panel.js';
import {createAccountUI} from '../account-ui.js';
const state={user:{uid:'owner',email:'parent@example.com',emailVerified:true},family:{id:'f',ownerId:'owner',name:'Our family'},status:'Saved to cloud'};
const data={profiles:[{id:'child',name:'Alex <test>',age:'child',avatar:'🌱'},{id:'deleted',name:'Removed',deleted:true}]};
test('control panel organizes accounts, profiles and reports without exposing deleted profiles',()=>{
  const overview=accountPanel({state,data,local:{profiles:[]}});assert.match(overview,/Account control panel/);assert.match(overview,/1 profile in/);assert.match(overview,/section-access/);
  const profiles=accountPanel({state,data,local:{profiles:[]},section:'profiles'});assert.match(profiles,/Alex &lt;test&gt;/);assert.match(profiles,/data-panel-edit="child"/);assert.doesNotMatch(profiles,/Removed/);
  const parent={...state,user:{...state.user,uid:'parent'}};
  assert.doesNotMatch(accountPanel({state:parent,data,local:{profiles:[]},section:'access'}),/id="invite-parent"/);
  assert.doesNotMatch(accessRows({members:[{uid:'owner',email:'owner@example.com',role:'owner'}],invites:[]},parent),/data-remove-member/);
});
test('panel navigation opens profile controls and requires confirmation for parent removal',async()=>{
  const window=new Window(),old={document:globalThis.document,FormData:globalThis.FormData};globalThis.document=window.document;globalThis.FormData=window.FormData;
  window.document.body.innerHTML='<dialog id="modal"></dialog>';const removed=[],opened=[];
  try{
    const ui=createAccountUI({cloud:{accessList:async()=>({members:[{uid:'owner',email:'parent@example.com',role:'owner'},{uid:'spouse',email:'spouse@example.com',role:'parent'}],invites:[]}),removeMember:async uid=>removed.push(uid)},getState:()=>state,getData:()=>data,getLocal:()=>({profiles:[]}),modal:html=>window.document.querySelector('#modal').innerHTML=html,close(){},toast(){},exportData(){},openProfile:id=>opened.push(id)});
    ui.show();window.document.querySelector('[data-account=section-profiles]').click();window.document.querySelector('[data-panel-profile]').click();assert.deepEqual(opened,['child']);
    window.document.querySelector('[data-account=section-access]').click();await new Promise(r=>setTimeout(r,5));window.document.querySelector('[data-remove-member]').click();assert.deepEqual(removed,[]);assert.match(window.document.body.textContent,/Remove parent access/);window.document.querySelector('#confirm-parent-removal').click();await new Promise(r=>setTimeout(r,5));assert.deepEqual(removed,['spouse']);
  }finally{window.happyDOM.abort();Object.assign(globalThis,old);}
});
