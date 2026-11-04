// Verify the unchanged server authority persists edits under the same QR slug.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const moduleText=fs.readFileSync('pixelping-worker/src/smart_actions.js','utf8');
 const {validateSmartAction,renderSmartAction}=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
 const source=fs.readFileSync('pixelping-worker/src/route_slug_registry.js','utf8')
  .replace(/^import .*;$/gm,'').replace('export class RouteSlugRegistry','class RouteSlugRegistry')+'\nRouteSlugRegistry';
 const Registry=vm.runInNewContext(source,{DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env}},validateSmartAction,Request,Response,console});
 for(const kind of ['phone','sms','email','coupon']){
  const state=new Map(),mirror=new Map();
  const ctx={storage:{get:async k=>state.get(k),put:async(k,v)=>state.set(k,v)},blockConcurrencyWhile:async fn=>fn()};
  const env={PIXELPING_KV:{get:async k=>mirror.get(k),put:async(k,v)=>mirror.set(k,v)}};
  const registry=new Registry(ctx,env),slug='unchanged-'+kind,userId='user_test';
  const call=async(action,extra={})=>{const response=await registry.fetch(new Request('https://registry.internal/',{method:'POST',body:JSON.stringify({action,slug,userId,...extra})}));return {status:response.status,data:await response.json()}};
  const action=kind==='phone'?{phone:'+17176232907'}:kind==='sms'?{phone:'+17176232907',message:'Original'}:kind==='email'?{email:'old@example.com',subject:'Original',message:'Original'}:{code:'OLD10',note:'Original',redeemUrl:null};
  const content={kind,title:'Example card',brand:{businessName:'Original Company',description:'Original',logoAssetId:null},action};
  assert.equal((await call('reserve')).status,200);assert.equal((await call('publish-action',{content})).status,200);await call('scan');
  const edited={...content,brand:{...content.brand,businessName:'Updated Company',description:'Updated'},action:kind==='phone'?{phone:'+12125551234'}:kind==='sms'?{phone:'+12125551234',message:'Updated SMS'}:kind==='email'?{email:'new@example.com',subject:'Updated subject',message:'Updated email'}:{code:'NEW20',note:'Updated offer',redeemUrl:'https://example.com/redeem'}};
  assert.equal((await call('update-action',{content:edited,userId:'user_other'})).status,403);
  assert.equal((await call('update-action',{content:edited})).status,200);
  const saved=await call('read');assert.equal(saved.data.route.slug,slug);assert.equal(saved.data.route.userId,userId);assert.equal(saved.data.scans,1);assert.equal(saved.data.route.brand.businessName,'Updated Company');assert.deepEqual(saved.data.route.action,edited.action);
  assert.equal(JSON.parse(mirror.get('link:'+slug)).slug,slug);
  const page=await renderSmartAction(saved.data.route).text();assert.match(page,/Updated Company/);assert.match(page,/Powered by/);
  if(kind==='phone')assert.match(page,/tel:\+12125551234/);
  if(kind==='sms')assert.match(page,/sms:\+12125551234\?body=Updated%20SMS/);
  if(kind==='email')assert.match(page,/mailto:new@example.com\?subject=Updated%20subject&amp;body=Updated%20email/);
  if(kind==='coupon'){assert.match(page,/NEW20/);assert.match(page,/https:\/\/example.com\/redeem/);}
  assert.equal((await call('update-action',{content:{...edited,brand:{businessName:''}}})).status,400);
  assert.equal((await call('read')).data.route.brand.businessName,'Updated Company');
 }
 console.log('PASS server authority: all four cards retain slug, owner and scans; updated pages render new details; wrong-owner and invalid writes rejected');
})().catch(e=>{console.error(e);process.exitCode=1});
