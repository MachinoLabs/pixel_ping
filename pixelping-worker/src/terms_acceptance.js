import { TERMS } from './terms_manifest.js';
import { validSignupEvidence } from './signup_terms_source.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function termsRequest(storage,body){
 const owner=body.userId;
 if(!/^user_[A-Za-z\d]+$/.test(owner||''))return json({error:'Invalid account.'},400);
 if(body.acceptance&&body.signupEvidence)return json({error:'Invalid agreement source.'},400);
 if(body.acceptance){const a=body.acceptance;if(Object.keys(a).some(k=>!['version','digest','terms','privacy'].includes(k))||a.version!==TERMS.version||a.digest!==TERMS.digest||a.terms!==true||a.privacy!==true)return json({error:'Agree to the current Terms and acknowledge the Privacy Policy.'},400)}
 // The public endpoint never accepts signupEvidence in a request body. Only its
 // authenticated, server-verified Clerk reconciliation can supply this record.
 if(body.signupEvidence&&!validSignupEvidence(body.signupEvidence))return json({error:'Invalid signup agreement evidence.'},400);
 return storage.transactionSync(()=>{
  const sql=storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS terms_acceptances (owner TEXT NOT NULL, version TEXT NOT NULL, digest TEXT NOT NULL, acknowledgments TEXT NOT NULL, accepted_at TEXT NOT NULL, PRIMARY KEY(owner,version))');
  sql.exec('CREATE TABLE IF NOT EXISTS terms_acceptance_sources (owner TEXT NOT NULL, version TEXT NOT NULL, digest TEXT NOT NULL, source TEXT NOT NULL, source_reference TEXT, source_accepted_at TEXT NOT NULL, recorded_at TEXT NOT NULL, PRIMARY KEY(owner,version))');
  if(body.acceptance||body.signupEvidence){
   const prior=[...sql.exec('SELECT digest FROM terms_acceptances WHERE owner=? AND version=?',owner,TERMS.version)][0];
   if(prior&&prior.digest!==TERMS.digest)return json({error:'Terms version conflict. Contact support.'},409);
   if(!prior){
    const recordedAt=new Date().toISOString(),evidence=body.signupEvidence,acceptedAt=evidence?new Date(evidence.acceptedAt).toISOString():recordedAt;
    sql.exec('INSERT INTO terms_acceptances (owner,version,digest,acknowledgments,accepted_at) VALUES (?,?,?,?,?)',owner,TERMS.version,TERMS.digest,JSON.stringify(TERMS.acknowledgments),acceptedAt);
    sql.exec('INSERT INTO terms_acceptance_sources (owner,version,digest,source,source_reference,source_accepted_at,recorded_at) VALUES (?,?,?,?,?,?,?)',owner,TERMS.version,TERMS.digest,evidence?'clerk-signup':'checkout',evidence?.reference||null,acceptedAt,recordedAt);
   }
  }
  const row=[...sql.exec('SELECT version,digest,accepted_at FROM terms_acceptances WHERE owner=? AND version=?',owner,TERMS.version)][0];
  const source=[...sql.exec('SELECT source,source_reference,recorded_at FROM terms_acceptance_sources WHERE owner=? AND version=? AND digest=?',owner,TERMS.version,TERMS.digest)][0];
  return json({success:true,owner,manifest:TERMS,accepted:Boolean(row&&row.digest===TERMS.digest),acceptance:row&&row.digest===TERMS.digest?{version:row.version,digest:row.digest,acceptedAt:row.accepted_at,...(source?{source:source.source,sourceReference:source.source_reference,recordedAt:source.recorded_at}:{})}:null});
 });
}
