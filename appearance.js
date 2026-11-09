import {duration} from './domain.js';

export function startAppearance() {
  const root=document.documentElement, app=document.querySelector('#app');
  const scheme=window.matchMedia('(prefers-color-scheme: dark)');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference=root.dataset.themePreference||'system', lastContext=null, lastTotal=0;
  let frame=null, counter=null;
  const progress=new Map();
  const effects=new Set();
  const dialog=document.createElement('dialog');
  dialog.id='appearance-dialog';dialog.setAttribute('aria-labelledby','appearance-title');
  dialog.innerHTML=`<button class="modal-close" id="close-appearance" aria-label="Close appearance settings">×</button><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="appearance-title">Your kind of light.</h2><p>Choose a theme for this device.</p><div class="theme-options" role="group" aria-label="Color theme"><button data-theme-choice="light"><span>☀</span>Light</button><button data-theme-choice="dark"><span>☾</span>Dark</button><button data-theme-choice="system"><span>◐</span>Use device setting</button></div><p class="fine motion-note">Gentle animations follow your device’s Reduce Motion setting.</p>`;
  document.body.append(dialog);
  const finishCounter=()=>{
    if(frame!==null)window.cancelAnimationFrame(frame);frame=null;
    if(counter?.node.isConnected)counter.node.textContent=duration(counter.total);
    counter=null;
  };
  const animate=(node,keyframes,options)=>{
    if(reduced.matches||typeof node.animate!=='function')return;
    const effect=node.animate(keyframes,options);effects.add(effect);
    effect.onfinish=()=>effects.delete(effect);effect.oncancel=()=>effects.delete(effect);
  };
  function applyTheme() {
    const dark=preference==='dark'||(preference==='system'&&scheme.matches);
    root.dataset.theme=dark?'dark':'light';root.dataset.themePreference=preference;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#14211d':'#f7f7ef');
    document.querySelectorAll('[data-open-appearance]').forEach(button=>{
      button.innerHTML=`<span aria-hidden="true">${dark?'☾':'☀'}</span><span class="theme-button-label">Theme</span>`;
      button.setAttribute('aria-label',`Appearance: ${dark?'dark':'light'} theme. Change theme`);
    });
    dialog.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===preference)));
  }
  function mountButton() {
    const header=app.querySelector('.topbar, .welcome>header');if(!header)return;
    const button=document.createElement('button');button.type='button';button.className='theme-button';button.dataset.openAppearance='';
    button.onclick=()=>dialog.showModal();header.append(button);applyTheme();
  }
  function animateDashboard() {
    finishCounter();for(const effect of effects)effect.cancel();effects.clear();
    const context=app.dataset.motionKey||'welcome';
    const newPage=context!==lastContext;lastContext=context;
    const totalNode=app.querySelector('[data-time-total]');
    const total=Number(totalNode?.dataset.timeTotal||0),from=newPage?0:lastTotal;lastTotal=total;
    if(totalNode){
      totalNode.setAttribute('aria-label',duration(total));
      if(!reduced.matches&&total!==from){
        const started=performance.now();counter={node:totalNode,total};
        const step=now=>{
          if(!totalNode.isConnected||reduced.matches){finishCounter();return;}
          const fraction=Math.min(1,(now-started)/480),ease=1-Math.pow(1-fraction,3);
          totalNode.textContent=duration(from+(total-from)*ease);
          if(fraction<1)frame=window.requestAnimationFrame(step);else{frame=null;counter=null;totalNode.textContent=duration(total);}
        };
        frame=window.requestAnimationFrame(step);
      }
    }
    if(newPage){
      app.querySelectorAll('.dashboard-grid>section,.goals-grid>button,.welcome-grid>.profile-card').forEach((card,index)=>{
        animate(card,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,delay:Math.min(index*55,165),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
      });
      const ring=app.querySelector('.time-ring');if(ring)animate(ring,[{opacity:.45,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:500,easing:'ease-out'});
    }
    app.querySelectorAll('.goal-item').forEach(goal=>{
      const bar=goal.querySelector('.progress i');if(!bar)return;
      const key=context+':'+goal.dataset.goal,width=parseFloat(bar.style.width)||0;
      const before=newPage?0:progress.get(key)??0;progress.set(key,width);
      if(before!==width)animate(bar,[{width:before+'%'},{width:width+'%'}],{duration:450,easing:'ease-out'});
    });
  }
  const observer=new window.MutationObserver(()=>{mountButton();animateDashboard();});
  observer.observe(app,{childList:true});
  dialog.querySelector('#close-appearance').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{
    preference=button.dataset.themeChoice;try{localStorage.setItem('dayshape-theme',preference);}catch{}applyTheme();
  });
  scheme.addEventListener('change',()=>{if(preference==='system')applyTheme();});
  reduced.addEventListener('change',()=>{if(reduced.matches){finishCounter();for(const effect of effects)effect.cancel();effects.clear();}});
  window.addEventListener('storage',event=>{
    if(event.key==='dayshape-theme'){preference=['dark','light'].includes(event.newValue)?event.newValue:'system';applyTheme();}
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('#minus,#plus')){
      const output=document.querySelector('#duration-output');if(output)animate(output,[{transform:'scale(1.045)'},{transform:'scale(1)'}],{duration:180,easing:'ease-out'});
    }
  });
  applyTheme();mountButton();animateDashboard();
  return {dialog,stop(){observer.disconnect();finishCounter();for(const effect of effects)effect.cancel();}};
}
