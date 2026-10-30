/* Account policy agreement at checkout only. Normal generator/navigation stays uninterrupted. */
(()=>{
 const manifest=window.pixelPingTermsManifest,API='https://pixelping-worker.amateuraiguy.workers.dev/api/terms';
 if(!manifest)return;
 const owner=()=>window.Clerk?.user?.id||null;
 let verified=null,flight=null,promptRun=null,finish=null;
 const dialog=document.createElement('dialog');dialog.className='pp-terms-dialog';dialog.setAttribute('aria-labelledby','terms-title');dialog.setAttribute('aria-describedby','terms-intro');
 const title=document.createElement('h2');title.id='terms-title';title.textContent='Before checkout';
 const intro=document.createElement('p');intro.id='terms-intro';intro.textContent='Please review our policies before continuing.';
 const label=document.createElement('label'),input=document.createElement('input'),sentence=document.createElement('span');input.type='checkbox';input.checked=false;input.required=true;
 function text(value){const span=document.createElement('span');span.textContent=value;return span}
 function link(value,path){const a=document.createElement('a');a.textContent=value;a.href=path;a.target='_blank';a.rel='noopener noreferrer';a.title='Opens in a new tab';return a}
 sentence.append(text('I agree to the '),link('Terms of Service',manifest.document),text(' and acknowledge the '),link('Privacy Policy',manifest.privacyDocument),text('.'));label.append(input,sentence);
 const error=document.createElement('p');error.setAttribute('role','alert');error.className='pp-terms-error';
 const actions=document.createElement('div');actions.className='pp-help-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.className='pp-dialog-action pp-dialog-neutral';const accept=document.createElement('button');accept.type='button';accept.textContent='Continue to Payment';accept.className='pp-dialog-action pp-dialog-save';accept.disabled=true;actions.append(cancel,accept);
 dialog.append(title,intro,label,error,actions);document.body.append(dialog);
 const same=(id,session)=>owner()===id&&window.Clerk?.session===session;
 const currentManifest=data=>data?.manifest?.version===manifest.version&&data.manifest.digest===manifest.digest;
 async function send(method,id,session){const controller=new AbortController();let timer;try{return await Promise.race([(async()=>{
  const token=await session?.getToken();if(!token||!same(id,session)||controller.signal.aborted)throw Error('Sign-in changed. Please try again.');
  const response=await fetch(API,{method,cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,...(method==='PUT'?{'Content-Type':'application/json'}:{})},...(method==='PUT'?{body:JSON.stringify({version:manifest.version,digest:manifest.digest,terms:true,privacy:true})}:{})});
  const data=await response.json();if(controller.signal.aborted||!same(id,session))throw Error('Sign-in changed. Please try again.');
  if(!response.ok)throw Error(data.error||'Agreement could not be saved. Reconnect and try again.');
  if(!currentManifest(data)||data.owner!==id)throw Error('The policies or account changed. Refresh PixelPing to review the current policies.');return data;
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Agreement could not be confirmed. Reconnect and try again.'))},10000)})])}finally{clearTimeout(timer)}}
 const stamp=(id,session,data)=>{if(!data.accepted||data.acceptance?.version!==manifest.version||data.acceptance?.digest!==manifest.digest||!Number.isFinite(Date.parse(data.acceptance?.acceptedAt)))throw Error('Agreement could not be confirmed. Please try again.');verified={id,session};};
 function close(run,result){if(promptRun!==run)return;const done=finish;finish=null;promptRun=null;if(dialog.open)dialog.close();done?.(result)}
 function prompt(run,notice=''){
  input.checked=false;accept.disabled=true;cancel.disabled=false;error.textContent=notice;promptRun=run;
  return new Promise(resolve=>{finish=resolve;dialog.showModal();cancel.focus()});
 }
 input.addEventListener('change',()=>{accept.disabled=!input.checked});
 cancel.addEventListener('click',()=>close(promptRun,false));dialog.addEventListener('close',()=>close(promptRun,false));
 accept.addEventListener('click',async()=>{
  if(accept.disabled||!input.checked||!promptRun||flight!==promptRun)return;
  const run=promptRun,{id,session}=run;accept.disabled=true;cancel.disabled=true;error.textContent='';
  try{
   if(!same(id,session)){close(run,false);return}
   const data=await send('PUT',id,session);
   if(flight!==run||promptRun!==run||!same(id,session)){close(run,false);return}
   stamp(id,session,data);close(run,true);
  }catch(e){if(promptRun===run){if(same(id,session))error.textContent=e.message;else close(run,false)}}finally{if(promptRun===run){accept.disabled=!input.checked;cancel.disabled=false}}
 });
 async function ensure({fresh=true}={}){
  const id=owner(),session=window.Clerk?.session;
  if(!id||!session){window.Clerk?.openSignIn?.();return false}
  if(!fresh&&verified?.id===id&&verified.session===session)return true;
  if(flight){if(flight.id===id&&flight.session===session)return flight.promise;close(flight,false)}
  const run={id,session};flight=run;
  run.promise=(async()=>{
   let notice='';
   try{
    try{const data=await send('GET',id,session);if(!same(id,session)||flight!==run)return false;if(data.accepted){stamp(id,session,data);return true}}
    catch(e){if(!same(id,session)||flight!==run)return false;notice=e.message}
    if(!same(id,session)||flight!==run)return false;
    return await prompt(run,notice);
   }finally{if(flight===run)flight=null}
  })();return run.promise;
 }
 window.pixelPingTerms={ensure};
 // Auth events dismiss stale checkout UI; they never open an agreement popup.
 for(const event of ['pixelping:auth-ready','pixelping:command-account'])window.addEventListener(event,()=>{
  if(verified&&!same(verified.id,verified.session))verified=null;
  if(flight&&!same(flight.id,flight.session))close(flight,false);
 });
})();
