/* Account-bound friendly labels. No route destination or QR artwork is changed. */
(() => {
 const sessionKey=s=>s?.id||s;
 const API='https://pixelping-worker.amateuraiguy.workers.dev/api/qr-names';
 let snapshot=null,run=0;
 const owner=()=>window.Clerk?.user?.id,session=()=>window.Clerk?.session;
 const key=state=>state?.mode==='dynamic'&&state.route?.slug?'route:'+state.route.slug:state?.assetId?'asset:'+state.assetId:null;
 const current=()=>snapshot?.owner===owner()&&sessionKey(snapshot?.session)===sessionKey(session());
 const announce=()=>window.dispatchEvent(new Event('pixelping:names-ready'));
 async function request(method,body){
  const id=owner(),s=session();if(!id||!s)throw Error('Sign in to sync QR names.');
  const token=await s.getToken();if(!token||id!==owner()||sessionKey(s)!==sessionKey(session()))throw Error('Account changed.');
  const response=await fetch(API,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},cache:'no-store',signal:AbortSignal.timeout(10000),...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(id!==owner()||sessionKey(s)!==sessionKey(session()))throw Error('Account changed.');
  if(!response.ok){const e=Error(data.error||'QR names are unavailable.');e.status=response.status;throw e}
  return {owner:id,session:s,names:Array.isArray(data.names)?data.names:[]};
 }
 async function refresh(){const generation=++run;if(!owner()||!session()){snapshot=null;announce();return}try{const data=await request('GET');if(run===generation){snapshot=data;announce()}}catch{if(run===generation){snapshot=null;announce()}}}
 window.pixelPingQrNames={
  key,refresh,
  forState(state,fallback=''){return(current()?snapshot.names.find(x=>x.key===key(state))?.name:null)||state?.friendlyName||fallback},
  async rename(state,name){
   if(typeof name!=='string'||!name.trim()||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw Error('Enter a name of 1–80 characters without line breaks.');
   const id=owner(),s=session(),k=key(state);if(!k)throw Error('Open this QR in Canvas before naming it.');
   if(!current())await refresh();if(id!==owner()||sessionKey(s)!==sessionKey(session()))throw Error('Account changed.');
   const previous=current()?snapshot.names.find(x=>x.key===k):null;
   ++run;
   try{const result=await request('PUT',{key:k,name:name.trim(),expectedRevision:previous?.revision||0});++run;snapshot=result;announce();await window.pixelPingSavedCodes?.sync();return true}
   catch(e){if(e.status===404&&!previous)return false;throw e}
  }
 };
 for(const event of ['pixelping:auth-ready','pixelping:codes-ready','focus','online'])window.addEventListener(event,refresh);
 window.addEventListener('DOMContentLoaded',()=>{
  const heading=document.getElementById('qr-content-heading');if(!heading)return;
  const b=document.createElement('button');b.type='button';b.className='pp-action-link text-xs font-bold underline';b.textContent='Name this QR';b.title='Give this QR a friendly name';const names=document.createElement('div');names.className='flex flex-wrap items-center gap-2 min-w-0';
  const currentName=document.createElement('span');currentName.id='qr-content-name';currentName.className='text-xs font-semibold text-slate-600 dark:text-slate-300 break-words';names.append(currentName,b);heading.insertAdjacentElement('afterend',names);
  const draw=()=>{try{const n=window.pixelPingQrNames.forState(window.pixelPingCanvas?.capture(),'');b.textContent=n?'Rename: '+n:'Name this QR — Unnamed QR';b.title=n?'Rename '+n:'Give this QR a friendly name';currentName.textContent=n||'Unnamed QR';const preview=document.getElementById('canvas-qr-name');if(preview)preview.textContent=n||'Unnamed QR'}catch{}};
  window.addEventListener('pixelping:canvas-ready',draw);document.addEventListener('click',()=>queueMicrotask(draw));window.addEventListener('pixelping:names-ready',draw);window.addEventListener('pixelping:codes-ready',draw);document.addEventListener('change',draw);draw();
  b.addEventListener('click',async()=>{
   const canvas=window.pixelPingCanvas;if(!canvas)return;
   const id=owner(),s=session(),state=canvas.capture();
   const a=await window.pixelPingHelp.ask({title:'Name this QR',message:'This is your workspace label. Changing it does not change the QR address, destination, appearance or Smart Print text.',name:window.pixelPingQrNames.forState(state,''),choices:[['save','Save Name','save'],['cancel','Cancel']]});
   if(a.action!=='save'||id!==owner()||sessionKey(s)!==sessionKey(session()))return;
   try{
    const synced=id&&s&&window.pixelPingHasMasterKey?.()?await window.pixelPingQrNames.rename(state,a.value):false;
    if(id!==owner()||sessionKey(s)!==sessionKey(session())||key(canvas.capture())!==key(state))return;
    canvas.setFriendlyName(a.value);draw();
    document.getElementById('canvas-saved-status').textContent=synced?'QR name synced to your account.':'QR named on Canvas. Save the code or design to keep this name.';
   }catch(e){if(id===owner()&&s===session())document.getElementById('canvas-saved-status').textContent=e.message}
  });
 });
})();
