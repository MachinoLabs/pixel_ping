import { qrNames, nameKey, setQrName } from './qr_names.js';
// Saved designs are account data. No route creation, editing or deletion occurs here.
const ID=/^[A-Za-z0-9_-]{16,80}$/;
const result=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function savedCodesRequest(storage,body,validState){
 const sql=storage.sql, owner=body.userId, op=body.operation;
 sql.exec('CREATE TABLE IF NOT EXISTS saved_codes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)');
 sql.exec('CREATE TABLE IF NOT EXISTS saved_code_operations (id TEXT PRIMARY KEY, owner TEXT NOT NULL)');
 const list=()=>{const labels=qrNames(storage,owner);return [...sql.exec('SELECT * FROM saved_codes WHERE owner=? ORDER BY updatedAt DESC, id',owner)].map(row=>({id:row.id,name:labels.find(x=>x.key===nameKey(JSON.parse(row.data),row.id))?.name||row.name,state:JSON.parse(row.data),revision:row.revision,createdAt:row.createdAt,updatedAt:row.updatedAt}));};
 if(op&&(!ID.test(op.id||'')||!ID.test(op.codeId||'')||!['create','update','rename','delete'].includes(op.type)||!Number.isSafeInteger(op.expectedRevision)||op.expectedRevision<0||(['create','update','rename'].includes(op.type)&&(typeof op.name!=='string'||!op.name.trim()||op.name.length>80||/[\u0000-\u001f\u007f]/.test(op.name)))||(['create','update'].includes(op.type)&&(!validState(op.state)||!['static','dynamic'].includes(op.state.mode)||!op.state.print))))return result({error:'Invalid saved design.'},400);
 return storage.transactionSync(()=>{
  const existingOwner=[...sql.exec('SELECT owner FROM workspace WHERE id=1')][0];
  const codesOwner=[...sql.exec('SELECT owner FROM saved_code_operations LIMIT 1')][0];
  if((existingOwner&&existingOwner.owner!==owner)||(codesOwner&&codesOwner.owner!==owner))return result({error:'Account mismatch.'},403);
  if(!op)return result({success:true,items:list()});
  const previous=[...sql.exec('SELECT owner FROM saved_code_operations WHERE id=?',op.id)][0];
  if(previous)return previous.owner===owner?result({success:true,items:list()}):result({error:'Account mismatch.'},403);
  const row=[...sql.exec('SELECT * FROM saved_codes WHERE id=?',op.codeId)][0];
  if(row&&row.owner!==owner)return result({error:'Account mismatch.'},403);
  let renamedKey=null;
  if(op.type==='create'){
   if(row||op.expectedRevision!==0)return result({error:'This saved design already exists. Refresh My Codes before saving.',items:list()},409);
   const count=[...sql.exec('SELECT COUNT(*) AS total FROM saved_codes WHERE owner=?',owner)][0].total;
   if(count>=50)return result({error:'My Codes is full (50/50). Delete a saved design before saving another.',items:list()},409);
   const key=nameKey(op.state,op.codeId), known=qrNames(storage,owner).find(x=>x.key===key);
   if(known)op.name=known.name;
   else if(key)renamedKey=key;
   const now=new Date().toISOString();
   sql.exec('INSERT INTO saved_codes (id,owner,name,data,revision,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',op.codeId,owner,op.name.trim(),JSON.stringify(op.state),1,now,now);
  }else{
   if(!row||row.revision!==op.expectedRevision)return result({error:'This design changed or was deleted on another device. Refresh and review it before saving again.',items:list()},409);
   if(op.type!=='delete')renamedKey=nameKey(op.type==='update'?op.state:JSON.parse(row.data),row.id);
   if(op.type==='delete')sql.exec('DELETE FROM saved_codes WHERE id=? AND owner=?',op.codeId,owner);
   else sql.exec('UPDATE saved_codes SET name=?, data=?, revision=?, updatedAt=? WHERE id=? AND owner=?',op.name.trim(),op.type==='update'?JSON.stringify(op.state):row.data,row.revision+1,new Date().toISOString(),op.codeId,owner);
  }
  if(renamedKey)setQrName(storage,owner,renamedKey,op.name.trim());
  sql.exec('INSERT INTO saved_code_operations (id,owner) VALUES (?,?)',op.id,owner);
  return result({success:true,items:list()});
 });
}
