const phone=document.querySelector('#phone'),statusText=document.querySelector('#status');
let mode='live',timer;
function refresh(){clearTimeout(timer);if(mode==='live'&&!document.hidden)phone.src='/api/frame?t='+Date.now();}
phone.onload=()=>{statusText.textContent=mode==='live'?'已连接 · 原生应用实时画面':'原生应用截图 · '+({chat:'聊天主界面',drawer:'会话侧栏',settings:'设置页面'}[mode]||'');if(mode==='live')timer=setTimeout(refresh,500);};
phone.onerror=()=>{statusText.textContent='等待应用画面…';if(mode==='live')timer=setTimeout(refresh,1500);};
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{clearTimeout(timer);mode=button.dataset.view;document.querySelectorAll('[data-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));if(mode==='live')refresh();else phone.src='/captures/'+mode+'.png';}));
document.querySelector('#zoom').addEventListener('change',event=>{const value=Number(event.target.value);document.documentElement.dataset.zoom=value?'actual':'fit';document.documentElement.style.setProperty('--screen-width',(value||585)+'px');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mode==='live')refresh();});
