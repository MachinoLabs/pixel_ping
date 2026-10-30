/* Command Center uses the existing account library and mutation contract. */
(() => {
 const sessionKey=s=>s?.id||s;
 const account=()=>{const value=window.pixelPingCommandAccount;return value?.owner===window.Clerk?.user?.id&&sessionKey(value?.session)===sessionKey(window.Clerk?.session)?value.account:null};
 window.pixelPingHasMasterKey=()=>Boolean(account()?.masterKeyOwned||['master-key','evolution'].includes(account()?.tier));
 window.pixelPingHasEvolution=()=>account()?.tier==='evolution';
 window.addEventListener('pixelping:command-account',()=>window.dispatchEvent(new Event('pixelping:auth-ready')));
 window.addEventListener('DOMContentLoaded',()=>{
  const lib=window.pixelPingSavedCodes,help=window.pixelPingHelp,$=id=>document.getElementById(id);
  if(!lib||!help)return;
  const modal=$('command-library');let routeStates=new Map(),routeOwner=null,routeSession=null,run=0,busy=false;
  const feedback=text=>$('library-feedback').textContent=text;
  const destination=state=>{const x=state.inputs||{};return x['pl-url']||x['pl-biz-review']||x['pl-biz-social']||x['pl-biz-menu']||x['pl-biz-booking']||x['pl-tel']||x['pl-sms-to']||x['pl-email-to']||x['pl-biz-coupon']||x['pl-text']||Object.values(x).find(Boolean)||'Saved content'};
  function button(label,fn,tone='ordinary'){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='pp-dialog-action pp-dialog-'+tone;b.addEventListener('click',()=>Promise.resolve(fn()).catch(e=>feedback(e.message)));return b}
  async function navigate(item,duplicate){
   const selectedOwner=lib.owner();
   if(busy)return;if(window.pixelPingRefreshCommandAccount)await window.pixelPingRefreshCommandAccount();if(selectedOwner!==lib.owner()){feedback('Your account changed. Open My Codes again.');return}if(!lib.paid()){feedback('Account access could not be confirmed. Refresh this page, then click Sync and try again. If needed, sign in again. Your saved designs are retained.');return}
   const owner=lib.owner(),session=window.Clerk?.session;
   if(duplicate){const answer=await help.ask({title:help.topics.duplicate[0],message:help.topics.duplicate[1],choices:[['cancel','Cancel'],['duplicate','Open Duplicate','ordinary']]});if(answer.action!=='duplicate')return}
   if(owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))return;
   // Only an owner and ID cross pages. Canvas loads the account-scoped design,
   // including its existing dirty-design guard; no route is written here.
   try{sessionStorage.setItem('pixelping-library-open-v1',JSON.stringify({owner,id:item.id,duplicate:Boolean(duplicate),time:Date.now()}))}catch{feedback('This browser could not prepare the design. Open it from My Codes in the generator.');return}
   window.location.assign('index.html?ppDraftReturn=1');
  }
  async function change(item,type){
   if(busy)return;if(!lib.paid()){feedback('Paid access is required to change saved designs. Your saved designs are retained.');return}
   const owner=lib.owner(),session=window.Clerk?.session;
   const answer=await help.ask(type==='rename'?{title:'Rename saved design',message:'The QR and its live destination will stay the same.',name:item.name,choices:[['rename','Rename','ordinary'],['cancel','Cancel']]}:{title:'Delete saved design?',message:`Delete “${item.name}” from My Codes?\n\n${help.topics.delete[1]}`,choices:[['cancel','Cancel'],['delete','Delete Saved Design','danger']]});
   if(answer.action!==type||owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))return;
   busy=true;try{const result=await lib.change(type,{item,name:answer.value});if(owner===lib.owner()&&sessionKey(session)===sessionKey(window.Clerk?.session))feedback(result.pending?'Saved on this device — sync pending':type==='rename'?'Saved design renamed.':'Saved design deleted. Its Dynamic route was not changed.')}finally{busy=false;render();if(modal.open)$('library-search').focus()}
  }
  let savingRoute=false;
  window.pixelPingSaveRouteDesign=async(slug,kind='link')=>{
   if(savingRoute)return;
   const owner=lib.owner(),session=window.Clerk?.session;
   if(!owner||!/^[a-zA-Z0-9_-]{1,80}$/.test(slug)||!['link','phone','sms','email','coupon'].includes(kind))return;
   savingRoute=true;
   try{
    await window.pixelPingRefreshCommandAccount?.();
    if(owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))throw Error('Your sign-in changed. Refresh this page, then click Sync and try again. If needed, sign in again.');
    const verified=account();
    if(!lib.paid()||!window.pixelPingHasEvolution()){
     const uncertain=!verified||['unavailable','unverified'].includes(verified.recoveryPhase);
     await help.ask({title:uncertain?'Account access not verified':'Evolution required',message:uncertain?'Refresh this page, then click Sync and try again. If needed, sign in again.':'Sign in with active Evolution to open a live Dynamic route. Your saved designs remain available in My Codes.'});return;
    }
    await lib.sync();if(owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))return;
    const saved=lib.items().find(x=>x.state.route?.slug===slug);
    if(saved){const a=await help.ask({title:'Already in My Codes',message:`“${saved.name}” already keeps a design for this route. Open it in Canvas to review or update it.`,choices:[['open','Open in Canvas','ordinary'],['cancel','Cancel']]});if(a.action==='open'&&owner===lib.owner()&&sessionKey(session)===sessionKey(window.Clerk?.session))await navigate(saved,false);return}
    if(lib.items().length>=50){await help.ask({title:'My Codes is full',message:'My Codes already holds 50 designs. Delete a saved design before adding another. Your live route will stay active.'});return}
    const a=await help.ask({title:'Save this route’s design',message:'Open this live route in Canvas, review its design, then name and save it to My Codes. Original styling is used when available in your current Canvas or Recent Codes; otherwise you can review a fresh design. This does not change the live route.',choices:[['open','Open & Review','ordinary'],['cancel','Cancel']]});
    if(a.action!=='open')return;
    if(owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))throw Error('Your sign-in changed. Refresh this page, then click Sync and try again. If needed, sign in again.');
    try{sessionStorage.setItem('pixelping-library-open-v1',JSON.stringify({owner,slug,kind,name:window.pixelPingRouteName?.(slug)||window.pixelPingQrNames?.forState({mode:'dynamic',route:{slug}},'')||'Unnamed QR',saveRoute:true,time:Date.now()}));window.location.assign('index.html?ppDraftReturn=1')}
    catch{await help.ask({title:'Canvas could not be opened',message:'This browser could not prepare the route. Return to the generator and try again.'})}
   }catch(e){const message=e.message||'Refresh this page, then click Sync and try again. If needed, sign in again.';feedback(message);help.ask({title:'Canvas could not be opened',message});}finally{savingRoute=false}
  };
  function render(){
   const owner=lib.owner(),items=lib.items();$('library-count').textContent=$('library-window-count').textContent=`(${items.length}/50)`;
   $('library-status').textContent=lib.status();$('library-retry').hidden=!lib.pending().length;$('library-discard').hidden=!lib.issue();
   const query=$('library-search').value.trim().toLowerCase(),filter=$('library-filter').value;
   const list=$('command-library-list');list.replaceChildren();
   for(const item of items.filter(x=>(filter==='all'||x.state.mode===filter)&&(x.name+' '+destination(x.state)).toLowerCase().includes(query))){
    const li=document.createElement('li');li.className='pp-library-card';const name=document.createElement('h3');name.textContent=item.name;
    const details=document.createElement('p'),badge=document.createElement('span'),dynamic=item.state.mode==='dynamic';badge.className='pp-code-type '+(dynamic?'pp-type-dynamic':'pp-type-static');badge.textContent=dynamic?'Dynamic':'Static';
    const status=document.createElement('span');status.textContent=(dynamic?' · '+(routeOwner===owner&&routeSession===window.Clerk?.session?routeStates.get(item.state.route?.slug)||'Unavailable — status not checked':'Unavailable — status not checked'):'')+' · Updated '+new Date(item.updatedAt).toLocaleDateString()+(item.pending?' · Sync pending':'');details.append(badge,status);
    const dest=document.createElement('p');dest.textContent='Saved destination: '+destination(item.state);
    const controls=document.createElement('div');controls.className='pp-library-actions';controls.append(button('Open in Canvas',()=>navigate(item,false)),button('Rename',()=>change(item,'rename')),button('Duplicate',()=>navigate(item,true)),help.bubble('duplicate'),button('Delete Saved Design',()=>change(item,'delete'),'danger'),help.bubble('delete'));
    li.append(name,details,dest,controls);
    const live=routeOwner===owner&&routeSession===window.Clerk?.session?routeStates.get(item.state.route?.slug):null;
    if(dynamic&&(!live||live==='Unavailable')){const info=document.createElement('p');info.textContent='Design retained. Refresh to check the route. If it was deleted, Duplicate creates a new QR that needs activation and new printed copies.';li.append(info,help.bubble('unavailable','Route help'))}
    list.append(li);
   }
   if(!list.children.length){const empty=document.createElement('li');empty.textContent=!owner?'Sign in to view your saved designs.':items.length?'No matching saved designs.':'No saved designs yet. Save a design from the generator to see it here.';list.append(empty)}
  }
  async function checkStatuses(){
   const owner=lib.owner(),session=window.Clerk?.session,generation=++run;routeOwner=owner;routeSession=session;routeStates=new Map();render();
   if(!owner||!session||!window.pixelPingHasEvolution())return;
   const controller=new AbortController();let timer;
   try{
    const data=await Promise.race([(async()=>{const token=await session.getToken();if(!token||controller.signal.aborted)return[];
     return Promise.all(['/api/links','/api/actions'].map(async path=>{try{const r=await fetch('https://pixelping-worker.amateuraiguy.workers.dev'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});return r.ok?await r.json():null}catch{return null}}))})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Route status timed out.'))},10000)})]);
    if(generation!==run||owner!==lib.owner()||sessionKey(session)!==sessionKey(window.Clerk?.session))return;
    for(const x of data[0]?.links||[])routeStates.set(x.slug,'Route active');for(const x of data[1]?.actions||[])routeStates.set(x.slug,'Route active');
    for(const item of lib.items()){const r=item.state.route;if(r&&!routeStates.has(r.slug)){const d=data[r.kind==='link'?0:1];const known=Array.isArray(r.kind==='link'?d?.links:d?.actions);routeStates.set(r.slug,known&&!r.activated?'Not activated':'Unavailable')}}
   }catch{/* Keep saved designs visible, without inventing a live status. */}finally{clearTimeout(timer);if(generation===run&&owner===lib.owner()&&sessionKey(session)===sessionKey(window.Clerk?.session))render()}
  }
  async function refresh(){await lib.sync();if(modal.open)checkStatuses()}
  $('library-open').addEventListener('click',()=>{render();modal.showModal();refresh()});$('library-close').addEventListener('click',()=>modal.close());
  $('library-search').addEventListener('input',render);$('library-filter').addEventListener('change',render);$('library-refresh').addEventListener('click',refresh);
  $('library-retry').addEventListener('click',()=>lib.retry());$('library-discard').addEventListener('click',async()=>{const owner=lib.owner(),session=window.Clerk?.session,a=await help.ask({title:'Discard pending changes?',message:'Remove changes not yet confirmed by your account? Existing account copies and live routes remain intact.',choices:[['cancel','Cancel'],['discard','Discard Pending Changes','danger']]});if(a.action==='discard'&&owner===lib.owner()&&sessionKey(session)===sessionKey(window.Clerk?.session))await lib.discardPending()});
  window.addEventListener('pixelping:codes-ready',render);
  window.addEventListener('pixelping:auth-ready',()=>{run++;routeStates.clear();feedback('');render();if(modal.open)refresh()});
  window.addEventListener('focus',()=>{if(modal.open)refresh()});
  render();lib.sync();
 });
})();
