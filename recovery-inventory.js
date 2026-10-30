/* Searchable, read-only inventory. Full route controls stay in Live Dynamic Routes. */
window.addEventListener('DOMContentLoaded',()=>{
 const open=document.getElementById('inventory-open');if(!open)return;
 const dialog=document.createElement('dialog');dialog.id='recovery-inventory-dialog';dialog.className='pp-help-dialog';dialog.setAttribute('aria-labelledby','inventory-title');
 const title=document.createElement('h2');title.id='inventory-title';title.textContent='Recovery Inventory';
 const intro=document.createElement('p');intro.textContent='Retained Dynamic routes. This list is read-only. Use Live Dynamic Routes to edit destinations, or My Codes for saved designs.';
 const search=document.createElement('input');search.type='search';search.maxLength=160;search.placeholder='Search name or QR identifier';search.setAttribute('aria-label','Search recovery inventory');
 const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const list=document.createElement('ul');list.className='pp-inventory-list';
 const actions=document.createElement('div');actions.className='pp-help-actions';
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='pp-dialog-action pp-dialog-ordinary';b.textContent=text;b.addEventListener('click',fn);return b};
 const previous=button('Previous',()=>load(page-1)),next=button('Next',()=>load(page+1)),retry=button('Retry',()=>load(page)),close=button('Close',()=>dialog.close());
 actions.append(previous,next,retry,close);dialog.append(title,intro,search,feedback,list,actions);document.body.append(dialog);
 let page=1,run=0,timer,controller;
 async function load(requested=1){
  clearTimeout(timer);controller?.abort();controller=new AbortController();
  const abort=controller,id=window.Clerk?.user?.id,session=window.Clerk?.session,generation=++run;
  const current=()=>dialog.open&&generation===run&&window.Clerk?.user?.id===id&&window.Clerk?.session===session;
  page=Math.max(1,requested);list.replaceChildren();feedback.textContent='Loading retained routes…';previous.disabled=next.disabled=true;retry.hidden=true;
  if(!id||!session){feedback.textContent='Sign in to view your retained routes.';return}
  let timeout;try{
   const data=await Promise.race([(async()=>{
    const token=await session.getToken();if(!current()||!token||abort.signal.aborted)throw Error('Sign-in changed.');
    const response=await fetch('https://pixelping-worker.amateuraiguy.workers.dev/api/recovery-inventory?'+new URLSearchParams({page:String(page),q:search.value.trim()}),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:abort.signal});
    const data=await response.json();if(!response.ok||!data.success||!Array.isArray(data.items))throw Error(data.error||'Inventory unavailable.');return data;
   })(),new Promise((_,reject)=>{timeout=setTimeout(()=>{abort.abort();reject(Error('Inventory request timed out.'))},10000)})]);
   if(!current())return;page=data.page;
   for(const item of data.items){const li=document.createElement('li'),name=document.createElement('strong'),code=document.createElement('span');name.textContent=item.name;code.textContent='/'+item.slug;li.append(name,code);list.append(li)}
   feedback.textContent=data.matches?`Page ${data.page} of ${data.pages} · ${data.matches} matches · ${data.total} retained routes`:'No matching retained routes.';
   previous.disabled=page<=1;next.disabled=page>=data.pages;
  }catch(e){if(current()){feedback.textContent=e.message+' Your routes have not been changed.';retry.hidden=false}}
  finally{clearTimeout(timeout)}
 }
 open.addEventListener('click',()=>{search.value='';dialog.showModal();search.focus();load(1)});
 search.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();run++;timer=setTimeout(()=>load(1),250)});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close()}});
 dialog.addEventListener('close',()=>{run++;controller?.abort();clearTimeout(timer);list.replaceChildren();open.focus()});
 window.addEventListener('pixelping:auth-ready',()=>{if(dialog.open)dialog.close();run++;controller?.abort();list.replaceChildren()});
});
