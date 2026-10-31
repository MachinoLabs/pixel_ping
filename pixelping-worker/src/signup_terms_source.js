import { TERMS } from './terms_manifest.js';

// Release-owned mapping, not a client claim. This conservative window starts at
// the first observed native signup checkbox after the owner configured both URLs.
// Do not derive the version/digest from TERMS: a later policy release must define
// a new verified signup window, otherwise old signup consent must not carry over.
export const SIGNUP_POLICY_SOURCE=Object.freeze({
    id:'clerk-production-unverified-batch73',
    version:'2026-10-17-v1',
    digest:'9c12deb0cadbf2c81750a87efa49e456930bd133fa4744f9831fabe1e0eae75c',
    issuer:'https://clerk.pixelping.app',
    termsUrl:'https://pixelping.app/terms.html',
    privacyUrl:'https://pixelping.app/privacy.html',
    validFrom:Number.POSITIVE_INFINITY,
    validUntil:null
});

export function validSignupEvidence(evidence,now=Date.now(),terms=TERMS,source=SIGNUP_POLICY_SOURCE){
    return Boolean(evidence && typeof evidence==='object' && !Array.isArray(evidence) &&
        Object.keys(evidence).every(k=>['source','reference','version','digest','acceptedAt'].includes(k)) &&
        evidence.source==='clerk-signup' && evidence.reference===source.id &&
        source.version===terms.version && source.digest===terms.digest &&
        evidence.version===source.version && evidence.digest===source.digest &&
        Number.isSafeInteger(evidence.acceptedAt) && evidence.acceptedAt>=source.validFrom &&
        evidence.acceptedAt<=now && (source.validUntil===null || evidence.acceptedAt<source.validUntil));
}

// legalAcceptedAt comes ONLY from the already authenticated Backend API user
// response. Browser user fields, unsafe metadata, JWT custom claims and client
// timestamps are never used as legal evidence.
export async function verifiedSignupEvidence(auth,env,{fetcher=fetch,now=Date.now(),terms=TERMS,source=SIGNUP_POLICY_SOURCE}={}){
    if((env.CLERK_ISSUER_URL||'').replace(/\/$/,'')!==source.issuer)return null;
    const evidence={source:'clerk-signup',reference:source.id,version:source.version,digest:source.digest,acceptedAt:auth.legalAcceptedAt};
    if(!validSignupEvidence(evidence,now,terms,source))return null;
    const controller=new AbortController();let timer;
    try {
        return await Promise.race([(async()=>{
            // Workers supports manual redirects; !response.ok below rejects 3xx
            // without following them or treating another host as signup evidence.
            const response=await fetcher(source.issuer+'/v1/environment',{cache:'no-store',redirect:'manual',signal:controller.signal});
            if(!response.ok || Number(response.headers.get('Content-Length'))>65536)return null;
            const bytes=await response.arrayBuffer();if(controller.signal.aborted || bytes.byteLength>65536)return null;
            const configuration=JSON.parse(new TextDecoder().decode(bytes));
            if(configuration.user_settings?.sign_up?.legal_consent_enabled!==true ||
                configuration.display_config?.terms_url!==source.termsUrl ||
                configuration.display_config?.privacy_policy_url!==source.privacyUrl)return null;
            return evidence;
        })(),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(null)},2500)})]);
    } catch { return null; }
    finally {clearTimeout(timer);}
}
