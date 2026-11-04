// Run: NODE_PATH=/path/to/linkedom/node_modules node tests/smart-card-management.cjs
// Exercises the actual Command Center functions against an isolated DOM and API.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const html = fs.readFileSync('admin.html','utf8');
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/\bsrc=/.test(m[1])) new vm.Script(m[2]);
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('const mainDash ='))[1];
const tick = () => new Promise(resolve=>setImmediate(resolve));
function harness() {
 const {window,document} = parseHTML(html);
 delete window.QRCodeStyling;
 // Linkedom omits browser form/select behavior; model only those platform APIs.
 for (const select of document.querySelectorAll('select')) {
  let value=select.querySelector('option')?.value||'';
  Object.defineProperty(select,'value',{get:()=>value,set:v=>{value=String(v)},configurable:true});
 }
 document.getElementById('actionEditForm').reset=()=>{for(const el of document.querySelectorAll('#actionEditForm input,#actionEditForm textarea'))el.value=''};
 for (const dialog of document.querySelectorAll('dialog')) {
  Object.defineProperty(dialog,'open',{get:()=>dialog.hasAttribute('open')});
  dialog.showModal=()=>dialog.setAttribute('open','');
  dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'))};
 }
 window.HTMLElement.prototype.getClientRects=()=>[{}];
 let active=null;window.HTMLElement.prototype.focus=function(){active=this};
 Object.defineProperty(document,'activeElement',{get:()=>active});
 const session={id:'session-one',getToken:async()=>'test-token'};
 window.Clerk={user:{id:'owner-one'},session,addListener(){}};
 window.pixelPingCommandAccount={account:{tier:'evolution'}};
 let choice='keep';window.pixelPingHelp={ask:async()=>({action:choice})};
 const requests=[];let failure=false, forbidden=false, responseSlug=null, hold=null;
 const records=['phone','sms','email','coupon'].map((kind,i)=>({slug:'card-'+kind,title:'Card '+kind,friendlyName:'Work '+kind,kind,scans:i,
  brand:{businessName:'MachinoLabs',description:'Your business',logoAssetId:null},
  action:kind==='phone'?{phone:'+17176232907'}:kind==='sms'?{phone:'+17176232907',message:'Hello'}:kind==='email'?{email:'hello@example.com',subject:'Inquiry',message:'Tell us more'}:{code:'SAVE10',note:'Offer',redeemUrl:'https://example.com/offer'}}));
 const web=[{slug:'website',title:'Store',destination:'https://example.com/store'}];
 const ctx=vm.createContext({window,document,console,URL,Event:window.Event,AbortSignal,setTimeout,clearTimeout,setInterval(){},navigator:{clipboard:{writeText:async()=>{}}},fetch:async(url,init={})=>{
  requests.push({url,init}); if(hold)await hold;if(failure)throw Error('Network interrupted');
  if(init.method==='PUT') {
   const draft=JSON.parse(init.body);const i=records.findIndex(r=>r.slug===draft.slug);
   if(forbidden)return {ok:false,status:403,json:async()=>({success:false})};
   records[i]={...records[i],...draft};return {ok:true,status:200,json:async()=>({success:true,slug:responseSlug||draft.slug})};
  }
  if(url.endsWith('/api/actions'))return {ok:true,json:async()=>({success:true,actions:records})};
  return {ok:true,json:async()=>({success:true,links:web})};
 }});
 vm.runInContext(script,ctx);
 vm.runInContext("loadAccountCenter=async()=>({tier:'evolution'}); suiteOwner=window.Clerk.user.id;globalLinksData=window.fixtureWeb;globalActionsData=window.fixtureCards;",Object.assign(ctx,{window:Object.assign(window,{fixtureWeb:web,fixtureCards:records})}));
 const run=s=>vm.runInContext(s,ctx), $=id=>document.getElementById(id), click=el=>el.dispatchEvent(new window.Event('click'));
 run('renderSuiteCards(globalLinksData)');
 return {window,document,run,$,click,records,requests,choice:v=>choice=v,failure:v=>failure=v,forbidden:v=>forbidden=v,responseSlug:v=>responseSlug=v,hold:v=>hold=v,submit:()=>document.getElementById('actionEditForm').dispatchEvent(new window.Event('submit',{cancelable:true}))};
}
(async()=>{
 let h=harness();
 assert.equal(h.document.querySelectorAll('[data-action-slug]').length,4);
 h.click(h.document.querySelector('[data-route-view="cards"]'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,4);assert.ok(!h.$('smart-card-kind-filter').hidden);assert.equal(h.document.querySelector('[data-route-view="cards"]').getAttribute('aria-pressed'),'true');
 h.$('smart-card-kind').value='sms';h.$('smart-card-kind').dispatchEvent(new h.window.Event('change'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,1);assert.equal(h.document.querySelector('[data-action-slug]').dataset.actionSlug,'card-sms');
 h.click(h.document.querySelector('[data-route-view="web"]'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,0);assert.ok(h.$('links-grid').textContent.includes('Store'));
 h.click(h.document.querySelector('[data-route-view="cards"]'));h.$('smart-card-kind').value='all';h.$('smart-card-kind').dispatchEvent(new h.window.Event('change'));
 h.$('search-input').value='hello@example.com';h.$('search-input').dispatchEvent(new h.window.Event('input'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,1);
 h.$('search-input').value='no-match';h.$('search-input').dispatchEvent(new h.window.Event('input'));assert.match(h.$('links-grid').textContent,/No matching/);assert.equal(h.requests.length,0);
 console.log('PASS filters, type selection, search, empty view, no writes while browsing');
 for(const kind of ['phone','sms','email','coupon']) {
  h=harness();h.run(`openActionEditor('card-${kind}')`);assert.equal(h.$('action-kind').value,kind);assert.equal(h.$('actionModal').hidden,false);
  assert.equal(h.$('action-view-saved').getAttribute('href'),'https://qr.pixelping.app/card-'+kind);
  assert.equal(h.$('action-phone-fields').hidden,!['phone','sms'].includes(kind));
  for(const group of ['sms','email','coupon'])assert.equal(h.$('action-'+group+'-fields').hidden,group!==kind);
  h.$('action-business-name').value='Updated MachinoLabs';h.submit();await tick();await tick();
  const writes=h.requests.filter(r=>r.init.method==='PUT');assert.equal(writes.length,1);const draft=JSON.parse(writes[0].init.body);
  assert.equal(draft.slug,'card-'+kind);assert.equal(draft.kind,kind);assert.equal(draft.brand.businessName,'Updated MachinoLabs');assert.ok(!('userId'in draft));assert.ok(!('destination'in draft));assert.equal(h.$('actionModal').hidden,true);assert.match(h.$('route-management-feedback').textContent,/saved/);
  assert.equal(h.records.find(r=>r.slug==='card-'+kind).brand.businessName,'Updated MachinoLabs');
 }
 console.log('PASS Phone/SMS/Email/Coupon hydrate, edit and PUT the original slug, confirm saved result');
 h=harness();h.run("openActionEditor('card-email')");h.$('action-email').value='invalid';h.submit();await tick();assert.equal(h.requests.length,0);assert.match(h.$('action-edit-feedback').textContent,/valid email/);
 h.$('action-email').value='valid@example.com';h.$('action-business-name').value='';h.submit();await tick();assert.equal(h.requests.length,0);assert.match(h.$('action-edit-feedback').textContent,/Business name/);
 h=harness();h.run("openActionEditor('card-coupon')");h.$('action-redeem-url').value='javascript:alert(1)';h.submit();await tick();assert.equal(h.requests.length,0);
 h=harness();h.run("openActionEditor('card-sms')");h.$('action-sms-message').value='a'.repeat(321);h.submit();await tick();assert.equal(h.requests.length,0);
 console.log('PASS invalid email, missing business, unsafe offer and over-limit message block writes');
 h=harness();h.run("openActionEditor('card-phone')");h.$('action-business-name').value='Unsaved';h.click(h.$('cancelActionBtn'));await tick();assert.equal(h.$('actionModal').hidden,false);h.choice('discard');h.click(h.$('cancelActionBtn'));await tick();assert.equal(h.$('actionModal').hidden,true);assert.equal(h.requests.length,0);
 h=harness();h.run("openActionEditor('card-email')");h.failure(true);h.submit();await tick();assert.match(h.$('action-edit-feedback').textContent,/not confirmed/);assert.equal(h.$('saveActionBtn').disabled,true);h.submit();await tick();assert.equal(h.requests.length,1);
 console.log('PASS canceled edits preserve saved card; ambiguous save blocks blind retry');
 h=harness();h.run("openActionEditor('card-phone')");h.window.Clerk.user={id:'other-owner'};h.submit();await tick();assert.equal(h.requests.length,0);
 h=harness();h.run("openActionEditor('card-phone')");h.window.Clerk.session={id:'other-session',getToken:async()=>'other-token'};h.submit();await tick();assert.equal(h.requests.length,0);
 h=harness();h.run("openActionEditor('card-phone')");let release;h.hold(new Promise(r=>release=r));h.submit();h.submit();await tick();assert.equal(h.requests.filter(r=>r.init.method==='PUT').length,1);h.click(h.$('cancelActionBtn'));await tick();assert.equal(h.$('actionModal').hidden,false);release();await tick();await tick();
 h=harness();h.run("openActionEditor('card-phone')");h.responseSlug('wrong-route');h.submit();await tick();assert.match(h.$('action-edit-feedback').textContent,/not confirmed/);assert.equal(h.$('route-management-feedback').hidden,true);
 console.log('PASS account/session changes, double submit, pending close and wrong-slug response guards');
 h=harness();h.run('invalidateActionIdentity()');assert.equal(h.$('route-filters').hidden,true);assert.equal(h.$('links-grid').children.length,0);assert.equal(h.$('route-results').textContent,'');
 console.log('PASS sign-out clears card inventory and status');
 h=harness();h.run("globalLinksData=Array.from({length:8},(_,i)=>({...globalLinksData[0],slug:'website-'+i}));renderSuiteCards(globalLinksData)");
 assert.equal(h.document.querySelectorAll('[data-action-slug]').length,0);h.click(h.$('route-next'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,4);
 h.click(h.document.querySelector('[data-route-view="cards"]'));assert.equal(h.document.querySelectorAll('[data-action-slug]').length,4);assert.match(h.$('route-page-status').textContent,/Page 1 of 1/);
 h=harness();h.run("loadAccountCenter=async()=>({tier:'master-key'})");await h.window.fetchLiveCards();assert.equal(h.$('route-filters').hidden,true);assert.ok(h.$('links-grid').classList.contains('hidden'));h.run("openActionEditor('card-email')");assert.equal(h.$('actionModal').hidden,true);
 h=harness();h.run("openActionEditor('card-email')");h.forbidden(true);h.submit();await tick();await tick();assert.equal(h.$('actionModal').hidden,true);assert.equal(h.$('route-management-feedback').hidden,true);assert.match(h.$('action-list-feedback').textContent,/unavailable/);
 h=harness();h.run("openActionEditor('card-phone')");h.$('action-kind').value='sms';h.$('action-kind').dispatchEvent(new h.window.Event('change'));h.$('action-sms-message').value='New text action';h.submit();await tick();await tick();assert.equal(h.records[0].slug,'card-phone');assert.equal(h.records[0].kind,'sms');assert.equal(h.records[0].action.message,'New text action');
 console.log('PASS mixed-route pagination, filter reset, non-Evolution gate, rejected save and in-place action change');


 const mockQR = h => {const seen=[];h.window.QRCodeStyling=class{constructor(options){seen.push(options)}append(holder){holder.append(h.document.createElement('svg'))}async getRawData(){return {}}};return seen};
 for(const kind of ['phone','sms','email','coupon']) {
  h=harness();const seen=mockQR(h);const trigger=h.document.querySelector(`[data-action-slug="card-${kind}"] [data-action-qr]`);
  h.click(trigger);await tick();assert.equal(h.$('smart-card-qr').open,true);assert.equal(seen.length,1);assert.equal(seen[0].data,'https://qr.pixelping.app/card-'+kind);assert.equal(seen[0].margin,32);assert.equal(seen[0].backgroundOptions.color,'#ffffff');assert.equal(h.requests.length,0);assert.equal(h.$('smart-card-qr-image').querySelectorAll('svg').length,1);
  h.click(h.$('smart-card-qr-close'));assert.equal(h.$('smart-card-qr').open,false);assert.equal(h.$('smart-card-qr-image').children.length,0);assert.equal(h.$('smart-card-qr-url').textContent,'');assert.equal(h.document.activeElement,trigger);
 }
 h=harness();let seen=mockQR(h);h.run("userBaseDomain='qr.customer.example';openSmartCardQr('card-email')");await tick();assert.equal(seen[0].data,'https://qr.customer.example/card-email');
 h=harness();mockQR(h);h.run("openSmartCardQr('not-owned')");assert.equal(h.$('smart-card-qr').open,false);
 h=harness();mockQR(h);h.run("suiteOwner=null;openSmartCardQr('card-email')");assert.equal(h.$('smart-card-qr').open,false);
 h=harness();mockQR(h);h.run("openSmartCardQr('card-email');invalidateActionIdentity()");await tick();assert.equal(h.$('smart-card-qr').open,false);assert.equal(h.$('smart-card-qr-image').children.length,0);
 h=harness();let resolveLibrary;h.run("loadSmartQrLibrary=()=>window.testLibrary");h.window.testLibrary=new Promise(r=>resolveLibrary=r);h.run("openSmartCardQr('card-email')");h.click(h.$('smart-card-qr-close'));mockQR(h);resolveLibrary(h.window.QRCodeStyling);await tick();assert.equal(h.$('smart-card-qr-image').children.length,0);
 h=harness();h.run("loadSmartQrLibrary=async()=>{throw Error('Offline')};openSmartCardQr('card-email')");await tick();assert.equal(h.$('smart-card-qr-retry').hidden,false);assert.match(h.$('smart-card-qr-status').textContent,/could not load/);mockQR(h);h.run("loadSmartQrLibrary=async()=>window.QRCodeStyling");h.click(h.$('smart-card-qr-retry'));await tick();assert.equal(h.$('smart-card-qr-retry').hidden,true);assert.equal(h.$('smart-card-qr-image').children.length,1);assert.equal(h.requests.length,0);
 h=harness();mockQR(h);h.run("openSmartCardQr('card-email');window.pixelPingCommandAccount=null;window.dispatchEvent(new Event('pixelping:command-account'))");await tick();assert.equal(h.$('smart-card-qr').open,false);
 h=harness();h.run("openSmartCardQr('card-email')");const scripts=()=>[...h.document.head.querySelectorAll('script')].filter(s=>s.src.includes('qr-code-styling'));
 assert.equal(scripts().length,1);let libraryScript=scripts()[0];libraryScript.onerror();await tick();assert.equal(h.$('smart-card-qr-retry').hidden,false);h.click(h.$('smart-card-qr-retry'));assert.equal(scripts().length,1);mockQR(h);scripts()[0].onload();await tick();assert.equal(h.$('smart-card-qr-image').children.length,1);
 console.log('PASS QR preview: four same-route URLs, custom domain, no writes, focus/close cleanup, owner/access loss, stale async result, load failure and retry');
 console.log('All Smart Card management checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

