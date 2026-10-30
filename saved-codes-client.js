/* Account-scoped saved designs. SVG artwork remains in the private icon service. */
(() => {
 const sessionKey=s=>s?.id||s;
 const API='https://pixelping-worker.amateuraiguy.workers.dev/api/codes', PREFIX='pixelping-my-codes-v1:';
 const blank=()=>({items:[],pending:[],issue:null});
 const owner=()=>window.Clerk?.user?.id || (window.pixelPingOfflineMasterKeyValidated?window.pixelPingOfflineMasterKeyOwnerId:null);
 const paid=()=>window.pixelPingHasMasterKey?.()===true;
 let active=null, message='Sign in to view My Codes.';
 const notice=()=>window.dispatchEvent(new Event('pixelping:codes-ready'));
 function read(id=owner()){try{const v=JSON.parse(localStorage.getItem(PREFIX+id));return v&&Array.isArray(v.items)&&Array.isArray(v.pending)?v:blank()}catch{return blank()}}
 function write(id,data){try{localStorage.setItem(PREFIX+id,JSON.stringify(data))}catch{throw Error('This browser could not store your design. Free some browser storage and try again.')}notice()}
 function projected(cache){const items=cache.items.map(x=>({...x}));for(const op of cache.pending){const i=items.findIndex(x=>x.id===op.codeId);if(op.type==='create'&&i<0)items.unshift({id:op.codeId,name:op.name,state:op.state,revision:1,createdAt:op.time,updatedAt:op.time,pending:true});else if(i>=0){if(op.type==='delete')items.splice(i,1);else items[i]={...items[i],name:op.name,state:op.type==='update'?op.state:items[i].state,revision:op.expectedRevision+1,updatedAt:op.time,pending:true}}}return items}
 function status(text){message=text;notice()}
 async function sync(){
  const id=window.Clerk?.user?.id,session=window.Clerk?.session;
  if(!id||!session){status(owner()?'Saved on this device — sync pending':'Sign in to view My Codes.');return}
  if(active?.id===id&&sessionKey(active.session)===sessionKey(session))return active.promise;
  const run={id,session};active=run;
  const current=()=>owner()===id&&sessionKey(window.Clerk?.session)===sessionKey(session)&&active===run;
  async function send(op){
   const controller=new AbortController();let timer;
   try{return await Promise.race([(async()=>{
    const token=await session.getToken();if(!token||!current()||controller.signal.aborted)throw Error('Sign-in changed.');
    const response=await fetch(API,{method:op?'PUT':'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,...(op?{'Content-Type':'application/json'}:{})},...(op?{body:JSON.stringify({operation:op})}:{}),signal:controller.signal});
    const data=await response.json();if(!current()||controller.signal.aborted)throw Error('Sign-in changed.');
    return{response,data};})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('My Codes timed out. Your local changes are still pending.'))},10000)})])}finally{clearTimeout(timer)}
  }
  const accept=(items,done)=>{if(!Array.isArray(items)||items.length>50)throw Error('My Codes returned an invalid response.');const c=read(id);write(id,{items,pending:c.pending.filter(x=>x.id!==done),issue:done&&c.issue?.id===done?null:c.issue})};
  run.promise=(async()=>{try{
   status('Syncing My Codes…');const initial=await send();
   if(!initial.response.ok)throw Error(initial.data.error||'My Codes is unavailable.');
   accept(initial.data.items);
   while(current()){
    const c=read(id),op=c.pending[0];if(!op)break;
    if(c.issue?.id===op.id){status(c.issue.error+' Your pending change is kept on this device.');return}
    if(!paid()){status('Paid access is required to sync pending changes. Your saved designs are retained.');return}
    const {response,data}=await send(op);
    if(response.ok){accept(data.items,op.id);continue}
    if(response.status>=400&&response.status<500){const latest=read(id);write(id,{...latest,items:Array.isArray(data.items)?data.items:latest.items,issue:{id:op.id,error:data.error||'This change needs review.'}});status((data.error||'This change needs review.')+' Your pending change is kept on this device.');return}
    throw Error(data.error||'My Codes is unavailable.');
   }
   if(current())status('Designs synced to your account');
  }catch(error){if(current())status('Saved on this device — sync pending. '+error.message)}finally{if(active===run)active=null}})();return run.promise;
 }
 window.pixelPingSavedCodes={
  owner,paid,items:()=>owner()?projected(read()):[],status:()=>message,pending:()=>owner()?read().pending:[],issue:()=>owner()?read().issue:null,sync,
  async change(type,{item,name,state}={}){
   const id=owner();if(!id||!paid())throw Error('Sign in with your paid account to save designs.');
   const c=read(id);if(c.issue)throw Error('Review your pending change before saving another design.');
   if(type==='create'&&projected(c).length>=50)throw Error('My Codes is full (50/50). Delete a saved design before saving another.');
   if(type!=='create'&&(!item||item.pending))throw Error('Wait for this design to finish syncing before changing it.');
   if(type!=='delete'&&(!name?.trim()||name.trim().length>80||/[\u0000-\u001f\u007f]/.test(name)))throw Error('Enter a name of 1–80 characters without line breaks.');
   const op={id:crypto.randomUUID(),codeId:type==='create'?crypto.randomUUID():item.id,type,expectedRevision:type==='create'?0:item.revision,name:name?.trim(),state,time:new Date().toISOString()};
   write(id,{...c,pending:[...c.pending,op]});status('Saved on this device — sync pending');await sync();
   if(owner()!==id)throw Error('Account changed. Your change remains with its original account.');
   const after=read(id);if(after.issue?.id===op.id)throw Error(after.issue.error+' Your pending change is kept on this device.');
   return {id:op.codeId,pending:after.pending.some(x=>x.id===op.id)};
  },
  async retry(){const id=owner();if(!id)return;const c=read(id);write(id,{...c,issue:null});return sync()},
  discardPending(){const id=owner();if(!id)return;const c=read(id);write(id,{...c,pending:[],issue:null});status('Pending changes discarded. Refreshing My Codes…');return sync()}
 };
 for(const event of ['pixelping:auth-ready','pixelping:entitlement-ready','pixelping:license-ready','online','focus'])window.addEventListener(event,()=>{if(active&&(active.id!==window.Clerk?.user?.id||active.session!==window.Clerk?.session))active=null;sync()});
 window.addEventListener('storage',e=>{if(e.key===PREFIX+owner())notice()});
})();
