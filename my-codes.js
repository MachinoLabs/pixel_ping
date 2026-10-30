/* Saved-design controls; existing Canvas serialization and route writes are reused. */
window.addEventListener('DOMContentLoaded',()=>{
 const sessionKey=s=>s?.id||s;
 const lib=window.pixelPingSavedCodes,canvas=window.pixelPingCanvas,$=id=>document.getElementById(id);
 if(!lib||!canvas)return;
 let opened=null,baseline='',suggested='',busy=false,bypass=false,selectedTab='recent',lastPayload=$('payload-type').value;
 let checkedOwner=null,routeStates=new Map(),routeRun=0;
 const fingerprint=state=>JSON.stringify({...state,date:'',friendlyName:'',route:state.route?{slug:state.route.slug,kind:state.route.kind}:null});
 const dirty=()=>Boolean(opened&&opened.owner===lib.owner()&&fingerprint(canvas.capture())!==baseline);
 function feedback(text){$('canvas-saved-status').textContent=text;}
 let dialogResolve=null;
 function ask({title,message,name,choices=[['ok','Got it']]}){
  if($('codes-dialog').open)return Promise.resolve({action:'cancel'});
  $('codes-dialog-title').textContent=title;$('codes-dialog-message').textContent=message;
  $('codes-dialog-name').hidden=name===undefined;$('codes-dialog-label').hidden=name===undefined;
  $('codes-dialog-name').value=name||'';$('codes-dialog-error').textContent='';$('codes-dialog-actions').replaceChildren();
  return new Promise(resolve=>{
   dialogResolve=resolve;
   for(const [action,label,tone] of choices){const button=document.createElement('button');button.type='button';button.textContent=label;button.className='pp-dialog-action pp-dialog-'+(tone||(action==='cancel'?'neutral':['delete','discard'].includes(action)?'danger':['save','activate'].includes(action)?'save':'ordinary'));button.addEventListener('click',()=>finish(action));$('codes-dialog-actions').append(button)}
   function finish(action){const value=$('codes-dialog-name').value.trim();if(name!==undefined&&action!=='cancel'&&(!value||value.length>80||/[\u0000-\u001f\u007f]/.test(value))){$('codes-dialog-error').textContent='Enter a name of 1–80 characters without line breaks.';return}const done=dialogResolve;dialogResolve=null;$('codes-dialog').close();done?.({action,value})}
   $('codes-dialog-form').onsubmit=e=>{e.preventDefault();finish(choices[0][0])};
   $('codes-dialog').showModal();if(name!==undefined){$('codes-dialog-name').focus();$('codes-dialog-name').select()}
  });
 }
 $('codes-dialog').addEventListener('close',()=>{if(dialogResolve){const done=dialogResolve;dialogResolve=null;done({action:'cancel'})}});
 const error=err=>feedback(err.message||String(err));
 async function help(){await ask({title:'Recent Codes and My Codes',message:'Recent keeps your last five saved or exported codes.\n\nMy Codes keeps up to 50 designs you deliberately save, across devices. Each includes its content, design and print settings.\n\nSaving a design does not activate a dynamic route. Deleting a design does not delete its route. Download QR creates a file; Preview & Print opens a print preview.'});}
 async function saveCurrent(asNew=false){
  if(busy||canvas.busy()){feedback('Wait for the current action to finish.');return false}
  if(!lib.owner()||!lib.paid()){window.openMasterKeyModal?.();return false}
  const owner=lib.owner(),snapshot=canvas.capture(),existing=!asNew&&opened?.owner===owner?opened:null;
  if(existing?.item.pending){feedback('Wait for this design to finish syncing before updating it.');return false}
  const title=existing?'Update Saved Code':'Save to My Codes';
  const answer=await ask({title,message:existing?'Update this saved design? Its live destination will not be changed.':'Saves this code’s content, design and print settings to your account. Dynamic activation is separate.',name:window.pixelPingQrNames?.forState(snapshot,'')||snapshot.friendlyName||existing?.item.name||suggested||snapshot.label.split('\n')[0].trim().slice(0,80)||'Untitled Code',choices:[['save',existing?'Update Saved Code':'Save Code'],['cancel','Cancel']]});
  if(answer.action!=='save')return false;
  if(lib.owner()!==owner){feedback('Account changed. Please review the design before saving.');return false}
  busy=true;
  try{
   const result=await lib.change(existing?'update':'create',{item:existing?.item,name:answer.value,state:snapshot});
   if(lib.owner()!==owner)return false;
   const item=lib.items().find(x=>x.id===result.id);
   if(!item)throw Error('The saved design could not be confirmed.');
   canvas.setFriendlyName?.(answer.value);opened={owner,item};baseline=fingerprint(snapshot);suggested='';
   feedback(result.pending?'Design saved on this device — sync pending':'Design saved to My Codes. Find it under My Codes — Saved Designs.');render();if(selectedTab==='codes')checkStatuses();return true;
  }catch(err){error(err);return false}finally{busy=false}
 }
 async function guard(){
  if(canvas.busy()||busy){feedback('Wait for the current save or route check to finish.');return false}
  if(!dirty())return true;
  const answer=await ask({title:'Save your changes?',message:`“${opened.item.name}” has unsaved design changes.`,choices:[['save','Save Changes'],['discard','Discard Changes'],['cancel','Cancel']]});
  if(answer.action==='save')return saveCurrent();return answer.action==='discard';
 }
 async function openDesign(item,duplicate=false){
  const owner=lib.owner(),session=window.Clerk?.session;
  if(!await guard()||lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
  let state=JSON.parse(JSON.stringify(item.state));
  if(state.mode==='static'&&!state.assetId&&item.id)state.assetId=item.id;
  state.friendlyName=duplicate?('Copy of '+item.name).slice(0,80):window.pixelPingQrNames?.forState(state,item.name)||state.friendlyName||item.name;
  if(!state.mode){const answer=await ask({title:'Open older Recent Code',message:'This older entry did not record whether it was Static or Dynamic. Open it as a Static copy? No existing route will be changed.',choices:[['open','Open Static Copy'],['cancel','Cancel']]});if(answer.action!=='open')return;state.mode='static';state.route=null}
  if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
  busy=true;
  try{await canvas.open(state,{duplicate});if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;opened=duplicate||item.recent?null:{owner,item:{...item}};suggested=duplicate?('Copy of '+item.name).slice(0,80):'';baseline=fingerprint(canvas.capture());lastPayload=$('payload-type').value;feedback(duplicate?'Duplicate opened in Canvas. Save it to My Codes when ready.':`Opened in Canvas: ${item.name}`);render();return true;}
  catch(err){error(err)}finally{busy=false}
 }
 window.pixelPingOpenRecent=state=>openDesign({name:window.pixelPingQrNames?.forState(state,'')||state.friendlyName||state.label.split('\n')[0].trim()||'Recent Code',state,recent:true});
 window.pixelPingActivateThenExport=async type=>{
  if(busy||canvas.busy()){feedback('Wait for the current action to finish.');return}
  if(window.pixelPingRouteUnavailable){await ask({title:'Dynamic route unavailable',message:'Check this route again before downloading or printing. You can review it in Command Center.',choices:[['ok','Got it']]});return}
  const owner=lib.owner(),session=window.Clerk?.session,request=fingerprint(canvas.capture()),format=$('export-format').value;
  const preview=type==='print'||format==='pdf',changed=canvas.destinationChanged?.();
  const actionLabel=changed?(preview?'Save Changes & Preview Print':'Save Changes & Download'):(preview?'Activate & Preview Print':'Activate & Download');
  const message=changed?(preview?'Save your edited destination, then open the print preview.':'Save your edited destination, then download your QR.'):(preview?'Activate this QR’s destination, then open the print preview.':'Activate this QR’s destination, then download your QR.');
  const answer=await ask({title:changed?'Save destination changes first':'Activate your dynamic QR first',message:message+(format==='pdf'?' Choose Save as PDF in the print dialog to create your PDF.':''),choices:[['activate',actionLabel],['cancel','Cancel']]});
  if(answer.action!=='activate'||lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
  busy=true;
  try{
   feedback(changed?'Saving destination changes…':'Activating your QR…');
   const active=await canvas.activate();
   if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
   if(!active||canvas.needsActivation()){feedback('Activation could not be confirmed for the current design. Your download or print has not started.');return}
   if(fingerprint(canvas.capture())!==request){feedback('QR activated, but the design changed. Review it, then choose Download QR or Preview & Print.');return}
   feedback(preview?'QR activated. Preparing print preview…':'QR activated. Preparing download…');
   const result=await canvas.export(type,format,()=>lib.owner()===owner&&sessionKey(window.Clerk?.session)===sessionKey(session)&&fingerprint(canvas.capture())===request);
   if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
   feedback(result==='preview'?'QR activated. Print preview is ready.':result==='download'?'QR activated. Download requested. If no file appears, click Download QR.':'QR activated, but the export could not be prepared. Choose Download QR or Preview & Print to try again.');
   if(selectedTab==='codes')checkStatuses();
  }catch(err){error(err)}finally{busy=false}
 };

 function destination(state){const inputs=state.inputs||{};return inputs['pl-url']||inputs['pl-biz-review']||inputs['pl-biz-social']||inputs['pl-biz-menu']||inputs['pl-biz-booking']||inputs['pl-tel']||inputs['pl-sms-to']||inputs['pl-email-to']||inputs['pl-biz-coupon']||inputs['pl-text']||Object.values(inputs).find(Boolean)||'Saved content'}
 async function checkStatuses(){
  const owner=window.Clerk?.user?.id,session=window.Clerk?.session,run=++routeRun;routeStates=new Map();checkedOwner=owner;
  if(!owner||!window.pixelPingHasEvolution?.()){render();return}
  let timer;
  try{
   const token=await Promise.race([session.getToken(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Status check timed out.')),10000)})]);clearTimeout(timer);if(!token)return;
   const base='https://pixelping-worker.amateuraiguy.workers.dev';
   const responses=await Promise.all(['/api/links','/api/actions'].map(path=>fetch(base+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(10000)})));
   const data=await Promise.all(responses.map(async r=>r.ok?await r.json():null));
   if(run!==routeRun||owner!==lib.owner()||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
   for(const x of data[0]?.links||[])routeStates.set(x.slug,'Route active');for(const x of data[1]?.actions||[])routeStates.set(x.slug,'Route active');
   // Only a successful owned-list response can establish that a draft has no live route.
   for(const item of lib.items()){const route=item.state.route;if(route&&!routeStates.has(route.slug)){const index=route.kind==='link'?0:1;const known=Array.isArray(index===0?data[index]?.links:data[index]?.actions);routeStates.set(route.slug,known&&!route.activated?'Not activated':'Unavailable')}}
  }catch{/* Existing account data remains visible when status lookup fails. */}finally{clearTimeout(timer);if(run===routeRun&&owner===lib.owner())render()}
 }
 function button(label,fn){const b=document.createElement('button');b.type='button';b.className='pp-action-link text-xs font-bold underline';if(label==='Delete Saved Design')b.className+=' pp-action-danger';b.textContent=label;b.addEventListener('click',()=>Promise.resolve(fn()).catch(error));return b}
 // Retain the library's occupied height so tab/list changes cannot collapse
 // the page beneath the sticky preview. Re-measure at a new viewport width.
 let libraryWidth=0,libraryHeight=0;
 function retainLibraryHeight(){
  const panel=$('history-container');
  if(!panel)return;
  const width=panel.getBoundingClientRect().width;
  if(!width)return;
  if(Math.abs(width-libraryWidth)>1){libraryWidth=width;libraryHeight=0;panel.style.minHeight=''}
  libraryHeight=Math.max(libraryHeight,Math.ceil(panel.getBoundingClientRect().height));
  panel.style.minHeight=libraryHeight+'px';
 }
 function render(){
  retainLibraryHeight();
  const owner=lib.owner();if(opened&&opened.owner!==owner){opened=null;baseline='';suggested=''}
  const items=lib.items();
  if(opened?.item.pending){const ack=items.find(x=>x.id===opened.item.id&&!x.pending);if(ack)opened.item={...ack}}
  const query=$('codes-search').value.trim().toLowerCase();
  $('tab-my-codes').textContent=`My Codes (${items.length}/50)`;$('codes-status').textContent=lib.status();
  $('codes-retry').hidden=!lib.pending().length;$('codes-discard').hidden=!lib.issue();
  $('btn-save-code').textContent=opened?'Update Saved Code':'Save to My Codes';$('btn-save-as-new').hidden=!opened;
  $('codes-list').replaceChildren();
  for(const item of items.filter(x=>(x.name+' '+destination(x.state)).toLowerCase().includes(query))){
   const li=document.createElement('li');li.className='rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2';
   const name=document.createElement('div');name.className='text-xs font-bold break-words';name.textContent=item.name;
   const details=document.createElement('p');details.className='text-xs text-slate-600 dark:text-slate-300 break-words';
   const dynamic=item.state.mode==='dynamic';const verified=checkedOwner===owner?routeStates.get(item.state.route?.slug):null;
   const badge=document.createElement('span');badge.className='pp-code-type '+(dynamic?'pp-type-dynamic':'pp-type-static');badge.textContent=dynamic?'Dynamic':'Static';
   const status=document.createElement('span');status.className='pp-code-metadata';status.textContent=`${dynamic?' · '+(verified||'Unavailable — status not checked'):''} · Updated ${new Date(item.updatedAt).toLocaleDateString()}${item.pending?' · Sync pending':''}`;details.append(badge,status);
   const dest=document.createElement('p');dest.className='text-xs truncate';dest.textContent=destination(item.state);dest.title=dest.textContent;
   const controls=document.createElement('div');controls.className='flex gap-3 mt-2';const open=button('Open',()=>openDesign(item));open.title='Open in Canvas';open.setAttribute('aria-label',`Open in Canvas: ${item.name}`);controls.append(open);
   const more=document.createElement('details');const summary=document.createElement('summary');summary.textContent='More actions';summary.className='text-xs cursor-pointer';more.append(summary);
   const actions=document.createElement('div');actions.className='flex flex-wrap gap-3 mt-2';
   actions.append(button('Rename',async()=>{if(!lib.paid()){window.openMasterKeyModal?.();return}const actionOwner=lib.owner();const answer=await ask({title:'Rename saved design',message:'The QR and its live destination will stay the same.',name:item.name,choices:[['save','Rename','ordinary'],['cancel','Cancel']]});if(answer.action==='save'&&lib.owner()===actionOwner){const owner=lib.owner();await lib.change('rename',{item,name:answer.value});if(opened?.item.id===item.id&&opened.owner===owner&&opened.item.revision===item.revision){const updated=lib.items().find(x=>x.id===item.id);if(updated)opened.item={...updated}}render()}}),button('Duplicate',()=>openDesign(item,true)),button('Delete Saved Design',async()=>{if(!lib.paid()){window.openMasterKeyModal?.();return}const actionOwner=lib.owner();const answer=await ask({title:'Delete saved design?',message:`Delete “${item.name}” from My Codes?\n\nThis removes only the saved design from My Codes. It does not delete or deactivate its dynamic route; any active QR keeps working.`,choices:[['cancel','Cancel'],['delete','Delete Saved Design']]});if(answer.action==='delete'&&lib.owner()===actionOwner){await lib.change('delete',{item});if(opened?.item.id===item.id){opened=null;baseline=''}render()}}));
   if(window.pixelPingHelp)actions.append(window.pixelPingHelp.bubble('duplicate'),window.pixelPingHelp.bubble('delete'));
   more.append(actions);controls.append(more);li.append(name,details,dest,controls);
   if(dynamic&&(!verified||verified==='Unavailable')){
    const info=document.createElement('p');info.className='text-xs text-slate-600 dark:text-slate-300 mt-2';info.textContent='Design retained. Refresh to check the route. If it was deleted, Duplicate creates a new QR that needs activation and new printed copies.';
    li.append(info,button('Route help',async()=>{const actionOwner=lib.owner(),session=window.Clerk?.session;const a=await ask({title:'Route unavailable — design retained',message:'A connection or account problem can prevent a status check. Refresh this page, then click Sync and try again. If needed, sign in again. If the route was deleted, it cannot be reactivated. You can duplicate this saved design into a new QR, activate it, then download and replace old printed copies.',choices:[['cancel','Close'],['duplicate','Duplicate into New QR']]});if(a.action==='duplicate'&&lib.owner()===actionOwner&&sessionKey(window.Clerk?.session)===sessionKey(session))await openDesign(item,true)}));
   }
   $('codes-list').append(li);
  }
  if(!$('codes-list').children.length){const li=document.createElement('li');li.className='text-xs text-slate-600 dark:text-slate-300 py-3';li.textContent=owner?(items.length?'No matching saved designs.':'No saved designs yet. Use Save to My Codes to keep one.'):'Sign in to view your saved designs.';$('codes-list').append(li)}
  retainLibraryHeight();
 }
 function tab(name){retainLibraryHeight();selectedTab=name;const my=name==='codes';$('history-content').hidden=my;$('workspace-sync-status').hidden=my;$('btn-clear-history').hidden=my;$('my-codes-panel').hidden=!my;$('recent-heading').textContent=my?'My Codes — Saved Designs':'Recent Codes — Last 5';$('tab-recent').setAttribute('aria-selected',String(!my));$('tab-my-codes').setAttribute('aria-selected',String(my));$('tab-recent').tabIndex=my?-1:0;$('tab-my-codes').tabIndex=my?0:-1;if(my){lib.sync();checkStatuses();const key='pixelping-my-codes-help-v1:'+lib.owner();let seen=false;try{seen=Boolean(localStorage.getItem(key))}catch{}if(lib.owner()&&!seen){help().then(()=>{try{localStorage.setItem(key,'seen')}catch{}})}}render()}
 $('tab-recent').addEventListener('click',()=>tab('recent'));$('tab-my-codes').addEventListener('click',()=>tab('codes'));
 for(const id of ['tab-recent','tab-my-codes'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const my=e.key==='End'||e.key!=='Home'&&selectedTab==='recent';tab(my?'codes':'recent');$(my?'tab-my-codes':'tab-recent').focus()}});
 $('codes-search').addEventListener('input',render);$('codes-help').addEventListener('click',help);
 $('btn-save-code').addEventListener('click',()=>saveCurrent());$('btn-save-as-new').addEventListener('click',()=>saveCurrent(true));
 $('codes-refresh').addEventListener('click',()=>{lib.sync();checkStatuses()});$('codes-retry').addEventListener('click',()=>lib.retry());
 $('codes-discard').addEventListener('click',async()=>{const a=await ask({title:'Discard pending changes?',message:'This removes changes that have not been confirmed by your account. Your existing account copies and live routes remain intact.',choices:[['cancel','Cancel'],['discard','Discard Pending Changes']]});if(a.action==='discard'){await lib.discardPending();opened=null;baseline='';render()}});
 window.addEventListener('pixelping:codes-ready',render);
 window.addEventListener('pixelping:names-ready',render);
 window.addEventListener('pixelping:auth-ready',()=>{routeRun++;routeStates.clear();render()});
 const updateDirty=()=>{lastPayload=$('payload-type').value;if(dirty())feedback('Unsaved design changes');};document.addEventListener('input',updateDirty);document.addEventListener('change',updateDirty);
 function detach(){window.pixelPingCanvasAssetId=crypto.randomUUID();window.pixelPingCanvasFriendlyName='';opened=null;baseline='';suggested='';render()}
 document.addEventListener('click',e=>{if(bypass)return;const target=e.target.closest?.('#btn-clear, .proxy-payload');if(!target)return;if(target.matches('.proxy-payload')&&(target.dataset.target??target.dataset.val)===$('payload-type').value)return;e.preventDefault();e.stopImmediatePropagation();guard().then(ok=>{if(ok){detach();bypass=true;try{target.click()}finally{bypass=false}}})},true);
 $('payload-type').addEventListener('change',e=>{if(bypass)return;const next=e.target.value;e.target.value=lastPayload;e.preventDefault();e.stopImmediatePropagation();guard().then(ok=>{if(ok){detach();bypass=true;try{e.target.value=next;e.target.dispatchEvent(new Event('change',{bubbles:true}))}finally{bypass=false}}})},true);
 window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue=''}});
 // A Command Center request reuses the same Canvas open/duplicate path and guard.
 let handoffBusy=false,returnDraftOwner;
 try{const draft=JSON.parse(sessionStorage.getItem('pixelping-command-center-draft-v1'));if(draft?.schema===1)returnDraftOwner=draft.owner}catch{}
 async function receiveLibraryDesign(){
  if(handoffBusy||!lib.owner()||window.pixelPingCommandDraftSettled===false||window.pixelPingAccountStatusPending===true||window.pixelPingAuthReady===false)return;
  let request;try{request=JSON.parse(sessionStorage.getItem('pixelping-library-open-v1'))}catch{return}
  if(!request)return;
  if(request.owner!==lib.owner()||!Number.isFinite(request.time)||Date.now()-request.time>600000){try{sessionStorage.removeItem('pixelping-library-open-v1')}catch{}feedback('The library request expired or belongs to a different account. Open My Codes to select a design.');return}
  if(request.saveRoute===true&&(!/^[a-zA-Z0-9_-]{1,80}$/.test(request.slug)||!['link','phone','sms','email','coupon'].includes(request.kind))){try{sessionStorage.removeItem('pixelping-library-open-v1')}catch{}feedback('This route request is invalid. Return to Command Center and try again.');return}
  const item=request.saveRoute===true?{name:typeof request.name==='string'?request.name.slice(0,80):'Unnamed QR',recent:true}:lib.items().find(x=>x.id===request.id);if(!item){if(lib.status()==='Designs synced to your account'){try{sessionStorage.removeItem('pixelping-library-open-v1')}catch{}feedback('This saved design is no longer available. Open My Codes to choose another.')}return}
  handoffBusy=true;const owner=lib.owner(),session=window.Clerk?.session;
  try{
   if(request.saveRoute===true){
    await window.pixelPingRefreshAccountStatus?.();
    if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))throw Error('Your sign-in changed. Refresh this page, then click Sync and try again. If needed, sign in again.');
    if(!window.pixelPingHasEvolution?.()&&window.pixelPingRefreshAccountStatus)throw Error('Dynamic access could not be confirmed. Refresh this page, then click Sync and try again. If needed, sign in again.');
   }
   if(returnDraftOwner===owner||window.pixelPingCommandReturnDraftOwner===owner){
    const answer=await ask({title:'Keep your current Canvas?',message:'Command Center restored your current Canvas. Save it to My Codes before opening another design, or replace it. Cancel keeps the current Canvas.',choices:[['save','Save to My Codes'],['discard','Replace Canvas'],['cancel','Cancel']]});
    if(answer.action==='cancel'){sessionStorage.removeItem('pixelping-library-open-v1');return}
    if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))throw Error('Your sign-in changed. Refresh this page, then click Sync and try again. If needed, sign in again.');
    if(answer.action==='save'&&!await saveCurrent())return;
    returnDraftOwner=undefined;window.pixelPingCommandReturnDraftOwner=undefined;
   }
   if(lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
   if(request.saveRoute===true){
    const saved=lib.items().find(x=>x.state.route?.slug===request.slug);
    if(saved){if(await openDesign(saved))sessionStorage.removeItem('pixelping-library-open-v1');feedback('This route already has a saved design in My Codes. Use Update Saved Code to keep any changes.');return}
    const design=canvas.routeDesign(request.slug,request.kind);
    item.state=design.state;
    item.state.friendlyName=window.pixelPingQrNames?.forState(design.state,request.name||design.state.friendlyName||'')||request.name||design.state.friendlyName||'Unnamed QR';
    item.name=item.state.friendlyName;
    if(!await openDesign(item)||lib.owner()!==owner||sessionKey(window.Clerk?.session)!==sessionKey(session))return;
    sessionStorage.removeItem('pixelping-library-open-v1');
    if(canvas.needsActivation()||window.pixelPingRouteUnavailable){feedback('The live route could not be confirmed. Review its status before saving this design.');return}
    const answer=await ask({title:'Review and save this route',message:design.source==='basic'?'This route is open with default QR styling because its original design was not available. Review it in Canvas, or name and save this design now. The live route is unchanged.':'This route is open with the design from your current Canvas or Recent Codes and its verified live destination. Name and save it to My Codes, or review it first.',choices:[['save','Name & Save to My Codes'],['cancel','Review Canvas First']]});
    if(answer.action==='save'&&lib.owner()===owner&&sessionKey(window.Clerk?.session)===sessionKey(session))await saveCurrent(true);
   }else if(await openDesign(item,request.duplicate===true))sessionStorage.removeItem('pixelping-library-open-v1');
  }catch(err){error(err)}finally{handoffBusy=false}
 }
 window.addEventListener('pixelping:entitlement-ready',receiveLibraryDesign);
 window.addEventListener('pixelping:command-draft-ready',receiveLibraryDesign);
 window.addEventListener('pixelping:codes-ready',receiveLibraryDesign);
 window.addEventListener('pixelping:auth-ready',receiveLibraryDesign);
 // Presets share the same unsaved-design guard and never write a route or design.
 window.pixelPingOpenArsenal=async recipe=>{
  const owner=lib.owner(),session=sessionKey(window.Clerk?.session);
  if(!await guard() || lib.owner()!==owner || sessionKey(window.Clerk?.session)!==session)return false;
  if(!canvas.applyArsenal?.(recipe))return false;
  opened=null;baseline='';suggested=recipe.name;lastPayload=$('payload-type').value;
  feedback('Arsenal draft opened: '+recipe.name+'. Complete your details before saving or exporting.');render();
  return true;
 };
 window.dispatchEvent(new Event('pixelping:canvas-controls-ready'));
 render();lib.sync();receiveLibraryDesign();
});
