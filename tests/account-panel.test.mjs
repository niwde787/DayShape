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


test('patterns section switches profile and week and returns after saving targets',()=>{
  const window=new Window(),old={document:globalThis.document,FormData:globalThis.FormData};Object.assign(globalThis,{document:window.document,FormData:window.FormData});
  const familyData={profiles:[{id:'a',name:'Alex'},{id:'b',name:'Blair'}],activities:[],entries:[],goals:[],routines:[]};let saves=0;
  try {
    const ui=createAccountUI({cloud:{},getState:()=>state,getData:()=>familyData,getLocal:()=>({profiles:[]}),modal:html=>window.document.body.innerHTML='<dialog id="modal">'+html+'</dialog>',close(){},toast(){},exportData(){},getActiveProfile:()=> 'b',getSelectedDate:()=> '2026-11-23',onDataChange:()=>saves++});
    ui.show();window.document.querySelector('[data-account=section-patterns]').click();
    assert.equal(window.document.querySelector('#pattern-profile').value,'b');assert.match(window.document.body.textContent,/For Blair/);
    const profile=window.document.querySelector('#pattern-profile');profile.value='a';profile.dispatchEvent(new window.Event('change'));
    const date=window.document.querySelector('#pattern-date');date.value='2026-11-16';date.dispatchEvent(new window.Event('change'));
    assert.match(window.document.body.textContent,/For Alex/);assert.match(window.document.body.textContent,/2026-11-16/);
    window.document.querySelector('[data-account=pattern-targets]').click();
    window.document.querySelector('#time-target-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    assert.equal(saves,1);assert.equal(window.document.querySelector('#pattern-date').value,'2026-11-16');assert.equal(window.document.querySelector('#pattern-profile').value,'a');
  }finally{window.happyDOM.abort();Object.assign(globalThis,old);}
});
