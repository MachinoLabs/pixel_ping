import { TERMS } from './terms_manifest.js';
import { verifiedSignupEvidence } from './signup_terms_source.js';
import { servePrivateIcon } from './private_icons.js';
export { AccountWorkspace } from './account_workspace.js';
// Batch 18: Durable Object implementation lives in one isolated module.
export { RouteSlugRegistry } from './route_slug_registry.js';
export { DomainRegistry } from './domain_registry.js';
import { validateSmartAction, renderSmartAction } from './smart_actions.js';

// Fail closed if the authoritative reservation namespace is unavailable.
async function claimRouteSlug(env, action, slug, userId) {
    if (!env.ROUTE_SLUG_REGISTRY?.idFromName || !env.ROUTE_SLUG_REGISTRY?.get) {
        return { status: 503, error: 'Route reservation service not configured.' };
    }
    try {
        const stub = env.ROUTE_SLUG_REGISTRY.get(env.ROUTE_SLUG_REGISTRY.idFromName(slug));
        const response = await stub.fetch(new Request('https://route-slug-registry.internal/', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, slug, userId })
        }));
        if (!response.ok) {
            return { status: response.status === 409 ? 409 : 503,
                error: response.status === 409 ? 'This route is already in use.' :
                    'Unable to verify route reservation.' };
        }
        return null;
    } catch (error) {
        console.error('Reservation namespace unavailable:', error.message);
        return { status: 503, error: 'Route reservation service unavailable.' };
    }
}

// Batch 19: the same per-slug Durable Object serializes scans, updates and
// tombstones. A failed lookup must not fall back to a racy KV mutation.
async function routeOperation(env, action, slug, extras = {}) {
    if (!env.ROUTE_SLUG_REGISTRY?.idFromName || !env.ROUTE_SLUG_REGISTRY?.get) {
        return { status: 503, error: 'Route service not configured.' };
    }
    try {
        const stub = env.ROUTE_SLUG_REGISTRY.get(env.ROUTE_SLUG_REGISTRY.idFromName(slug));
        const response = await stub.fetch(new Request('https://route-slug-registry.internal/', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, slug, ...extras })
        }));
        const result = await response.json();
        if (!response.ok) return { status: response.status, error: result.error || 'Route unavailable.' };
        return { status: 200, ...result };
    } catch (error) {
        console.error('Durable route request failed:', error.message);
        return { status: 503, error: 'Route service unavailable.' };
    }
}

// Friendly names live with account-owned designs, never in the redirect payload.
async function accountQrNames(env,userId,operation) {
    const stub=env.ACCOUNT_WORKSPACE.get(env.ACCOUNT_WORKSPACE.idFromName(userId));
    return stub.fetch(new Request('https://account-workspace.internal/names',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,operation})}));
}
async function namedRoutes(env,userId,routes) {
    let names=[];
    try{const r=await accountQrNames(env,userId);if(r.ok)names=(await r.json()).names||[];}catch{/* Routing remains independent of label availability. */}
    return routes.map(route=>{
        const stored=names.find(x=>x.key==='route:'+route.slug);
        let fallback=route.title && route.title!==route.slug ? route.title : route.brand?.businessName;
        if(!fallback && route.destination){try{fallback=new URL(route.destination).hostname;}catch{}}
        return {...route,friendlyName:stored?.name||fallback||'Dynamic QR',nameRevision:stored?.revision||0};
    });
}

// Batch 13: signed lifetime Master Key receipt, no trust in browser flags.
const OFFLINE_MASTER_KEY_KID = 'mk-v1';
function offlineB64Url(bytes) {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function issueSignedMasterKeyReceipt(env, licenseKey, license) {
    const signingKey = env.OFFLINE_LICENSE_SIGNING_PKCS8;
    if (!signingKey || typeof signingKey !== 'string') throw new Error('Offline license signing not configured');
    const der = Uint8Array.from(atob(signingKey.trim()), c => c.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey('pkcs8', der,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(licenseKey)));
    const payload = {
        v: 1, product: 'pixelping', kid: OFFLINE_MASTER_KEY_KID,
        tier: 'master-key', userId: license.userId,
        licenseHash: Array.from(hash, x => x.toString(16).padStart(2, '0')).join(''),
        issuedAt: Math.floor(Date.now() / 1000)
    };
    const claim64 = offlineB64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const signedBytes = new TextEncoder().encode(`pp1.${claim64}`);
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signedBytes));
    return `pp1.${claim64}.${offlineB64Url(signature)}`;
}

// Batch 03: verify Clerk session JWT before accessing any customer-owned routes.
// Required Cloudflare bindings: CLERK_ISSUER_URL (https://<your-clerk-instance>),
// CLERK_SECRET_KEY (Worker secret). No authentication secrets belong in this file.
function decodeB64Url(value) {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function authorizeAccount(request, env, corsHeaders) {
    const jsonError = (message, status) => ({ response: new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" }
    }) });
    if (!env.CLERK_ISSUER_URL || !env.CLERK_SECRET_KEY) {
        return jsonError("Account authentication is not configured.", 503);
    }
    const bearer = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") || "");
    if (!bearer) return jsonError("Authentication required.", 401);
    try {
        const issuer = env.CLERK_ISSUER_URL.replace(/\/$/, "");
        if (!issuer.startsWith("https://")) return jsonError("Authentication is not configured.", 503);
        const parts = bearer[1].split(".");
        if (parts.length !== 3) return jsonError("Invalid session.", 401);
        const header = JSON.parse(new TextDecoder().decode(decodeB64Url(parts[0])));
        const claims = JSON.parse(new TextDecoder().decode(decodeB64Url(parts[1])));
        const now = Math.floor(Date.now() / 1000);
        if (header.alg !== "RS256" || !header.kid ||
            claims.iss !== issuer || typeof claims.sub !== "string" || !claims.sub.startsWith("user_") ||
            !Number.isInteger(claims.exp) || claims.exp <= now ||
            (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 30)) ||
            (claims.iat !== undefined && (!Number.isInteger(claims.iat) || claims.iat > now + 30))) {
            return jsonError("Invalid or expired session.", 401);
        }
        const keyResponse = await fetch(`${issuer}/.well-known/jwks.json`);
        if (!keyResponse.ok) throw new Error("Unable to load signing keys");
        const jwks = await keyResponse.json();
        const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === "RSA" &&
            (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"));
        if (!jwk) return jsonError("Session signing key not recognized.", 401);
        const cryptoKey = await crypto.subtle.importKey("jwk", jwk,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
        const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey,
            decodeB64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
        if (!verified) return jsonError("Invalid session signature.", 401);
        // Resolve tier server-side: a browser's publicMetadata/localStorage is not authority.
        const userResponse = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(claims.sub)}`, {
            headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` }
        });
        if (!userResponse.ok) throw new Error("Unable to resolve account entitlement");
        const clerkUser = await userResponse.json();
        if (clerkUser.id !== claims.sub) return jsonError("Account mismatch.", 401);
        return { userId: claims.sub, metadata: clerkUser.public_metadata || {}, legalAcceptedAt: clerkUser.legal_accepted_at };
    } catch (error) {
        // Fail closed: never allow requests merely because signature validation errored.
        console.error("Account authorization failed:", error.message);
        return jsonError("Unable to verify account.", 503);
    }
}

// Batch 68: paid invoice evidence drives the same timeline for route scans,
// editing and account recovery. Grace/archive are retained states, never deletes.
function evolutionRecovery(access, userId, now = Math.floor(Date.now() / 1000)) {
    const valid = access && access.userId === userId &&
        typeof access.subscriptionId === 'string' && access.subscriptionId.startsWith('sub_') &&
        Number.isSafeInteger(access.paidThrough) && access.paidThrough > 0 &&
        access.paidThrough <= 253367740799; // Leave room for the retention interval.
    if (!valid) return { paidThrough: null, graceEndsAt: null, archiveEndsAt: null, recoveryPhase: 'unverified' };
    const paidThrough = access.paidThrough, graceEndsAt = paidThrough + 30 * 86400;
    const date = new Date(graceEndsAt * 1000), day = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 12);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1, 0)).getUTCDate()));
    const archiveEndsAt = Math.floor(date.getTime() / 1000);
    return { paidThrough, graceEndsAt, archiveEndsAt,
        recoveryPhase: now < paidThrough ? 'active' : now < graceEndsAt ? 'grace' :
            now < archiveEndsAt ? 'archived' : 'deletion-eligible' };
}
async function readEvolutionAccess(env, userId) {
    const raw = await env.PIXELPING_KV.get(`account-access:${userId}`);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (evolutionRecovery(value, userId).recoveryPhase === 'unverified')
        throw new Error('Verified billing history is unavailable.');
    return value;
}
async function verifiedEvolutionAccess(env, userId) {
    try { return evolutionRecovery(await readEvolutionAccess(env, userId), userId).recoveryPhase === 'active'; }
    catch { return false; }
}
// Current in-app guidance is derived from verified history, not a promise that
// email or Cron is configured. Stable milestone dates respect Mark all read.
function recoveryNotice(recovery, access, userId, now = Math.floor(Date.now() / 1000)) {
    const { recoveryPhase: phase, paidThrough, graceEndsAt, archiveEndsAt } = recovery;
    if (!paidThrough) return null;
    let kind = phase, at, title, detail;
    if (phase === 'active') {
        if (['past_due', 'unpaid', 'incomplete'].includes(access.status)) {
            kind = 'payment-attention'; at = Number.isFinite(Date.parse(access.updatedAt)) ? Math.floor(Date.parse(access.updatedAt)/1000) : 0;
            title = 'Evolution payment needs attention';
            detail = 'Your verified paid period still applies. Review your existing subscription and payment method; do not buy a second subscription to fix a failed renewal.';
        } else if (access.cancelAtPeriodEnd === true) {
            kind = 'cancellation'; at = Number.isFinite(Date.parse(access.updatedAt)) ? Math.floor(Date.parse(access.updatedAt)/1000) : 0;
            title = 'Evolution renewal is canceled';
            detail = 'Dynamic QR codes work until the paid-through date. Contact billing support to resume the existing subscription before it ends.';
        } else if (paidThrough - now <= 7*86400) {
            kind = 'renewal'; at = paidThrough - 7*86400;
            title = 'Evolution paid-through date approaching';
            detail = 'A successful renewal extends access automatically. Check your payment method if renewal needs attention. You do not need a second subscription.';
        } else return null;
    } else if (phase === 'grace') {
        at = paidThrough; title = 'Dynamic QR codes paused — 30-day grace period';
        detail = 'Your paid period ended. Routes, destinations and scan totals are retained. A confirmed paid renewal restores retained codes at the same addresses, without reprinting.';
    } else if (phase === 'archived') {
        at = graceEndsAt; title = 'Dynamic QR codes archived';
        detail = 'Redirects remain paused. Routes, destinations and scan totals are retained for 12 months after grace ends. A confirmed paid renewal restores retained codes without reprinting.';
    } else {
        at = archiveEndsAt; title = 'Dynamic QR archive period ended';
        detail = 'No records are deleted automatically. Contact support to check recovery before paying. A manually deleted route cannot be restored by renewal.';
    }
    return { id: `recovery-${userId}-${paidThrough}-${kind}`, at: new Date(Math.min(at, now)*1000).toISOString(),
        type: `recovery.${kind}`, title, detail, category: 'billing', notify: true, channel: 'in-app' };
}

// Keep route-management entitlements separate from account-recovery access.
async function authorizeEvolution(request, env, corsHeaders) {
    const auth = await authorizeAccount(request, env, corsHeaders);
    if (auth.response) return auth;
    if (auth.metadata.tier !== "evolution" || !await verifiedEvolutionAccess(env, auth.userId)) {
        return { response: new Response(JSON.stringify({ error: "Evolution subscription required." }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        }) };
    }
    return auth;
}

// All account events are server-owned and scoped by the authenticated Clerk identity.
async function recordAccountEvent(kv, userId, event) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const key = `account-event:${userId}:${Date.now().toString().padStart(13, '0')}:${id}`;
    await kv.put(key, JSON.stringify({
        id, at: now, type: event.type, title: event.title, detail: event.detail,
        category: event.category || 'account', notify: event.notify !== false
    }));
    // Outbox state is keyed by the server-created event ID and is visible only
    // through the owning account's authenticated Account Center response.
    if (event.notify !== false) {
        await kv.put(`email-outbox:${userId}:${id}`, JSON.stringify({
            userId, eventId: id, eventKey: key, status: 'pending', attempts: 0,
            nextAttemptAt: 0, createdAt: now, providerEmailId: null
        }));
    }
}

async function accountEvents(kv, userId) {
    const items = [];
    let cursor;
    let pages = 0;
    do {
        const page = await kv.list({ prefix: `account-event:${userId}:`, ...(cursor ? { cursor } : {}) });
        for (const key of page.keys) {
            const raw = await kv.get(key.name);
            if (raw) {
                try {
                    const value = JSON.parse(raw);
                    if (value && typeof value.title === 'string' && typeof value.at === 'string') {
                        items.push({ id: String(value.id || ''), at: value.at,
                            type: String(value.type || ''), title: value.title.slice(0, 160),
                            detail: String(value.detail || '').slice(0, 500),
                            category: String(value.category || 'account'), notify: value.notify !== false });
                    }
                } catch (_) { /* a damaged single event must not hide the account */ }
            }
        }
        cursor = page.list_complete === false ? page.cursor : undefined;
        if (++pages > 100) throw new Error('Event history is too large to read safely');
    } while (cursor);
    const recent = items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 100);
    await Promise.all(recent.map(async event => {
        if (!event.notify || !event.id) return;
        const record = await kv.get(`email-outbox:${userId}:${event.id}`);
        event.emailStatus = record ? String(JSON.parse(record).status || 'pending') : 'pending';
    }));
    return recent;
}

function safeRouteDestination(value) {
    if (typeof value !== "string" || value.length > 2048) return null;
    try {
        const url = new URL(value);
        if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname ||
            url.username || url.password || /[\r\n]/.test(value)) return null;
        return url.toString();
    } catch { return null; }
}

function validSlug(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(value) &&
        !["api", "admin", "help", "verify"].includes(value.toLowerCase());
}

async function getOwnedLinks(kv, userId) {
    const links = [];
    let cursor;
    let pages = 0;
    do {
        const result = await kv.list({ prefix: "link:", ...(cursor ? { cursor } : {}) });
        for (const key of result.keys) {
            const raw = await kv.get(key.name);
            if (!raw) continue;
            const record = JSON.parse(raw);
            if (record.userId === userId) links.push(record);
        }
        cursor = result.list_complete === false ? result.cursor : undefined;
        if (++pages > 100) throw new Error("Too many route pages");
    } while (cursor);
    return links;
}

// Dashboard reads are derived from the authoritative route record in the DO.
// A stale KV listing cannot resurrect a deleted route or stale destination.
async function getOwnedLiveLinks(env, userId) {
    const listed = await getOwnedLinks(env.PIXELPING_KV, userId);
    const live = [];
    for (const item of listed) {
        const result = await routeOperation(env, 'read', item.slug);
        if (result.status === 404) continue;
        if (result.status !== 200) throw new Error('Route statistics unavailable');
        if (result.route.userId !== userId) continue;
        live.push({ ...result.route, clicks: result.scans });
    }
    return live;
}

// Batch 09: verified Cloudflare for SaaS custom-hostname onboarding.
// Only subdomain CNAMEs are supported here. Apex proxying requires a distinct
// Cloudflare feature/configuration and must not be advertised as ready.
function normalizeCustomerHostname(value) {
    if (typeof value !== 'string') return null;
    const host = value.trim().toLowerCase().replace(/\.$/, '');
    if (host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return null;
    const labels = host.split('.');
    if (labels.length < 3 || labels.some(x => x.length < 1 || x.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x))) return null;
    if (labels.at(-1).length < 2 || /^\d+$/.test(labels.at(-1))) return null;
    if (host.endsWith('.pixelping.app') || host.endsWith('.workers.dev') ||
        host.endsWith('.cloudflare.com') || host.endsWith('.localhost') ||
        host === 'localhost') return null;
    return host;
}
function domainSetupConfigured(env) {
    const target = String(env.CF_SAAS_CNAME_TARGET || '').trim().toLowerCase().replace(/\.$/, '');
    if (!env.CF_SAAS_API_TOKEN || !/^[a-f\d]{32}$/i.test(String(env.CF_SAAS_ZONE_ID || '')) ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(target) ||
        target === 'pixelping.app') return null;
    return target;
}
async function cfCustomHostname(env, action, id, hostname) {
    const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_SAAS_ZONE_ID}/custom_hostnames` +
        (id ? `/${encodeURIComponent(id)}` : '');
    const rsp = await fetch(url, {
        method: action,
        headers: { Authorization: `Bearer ${env.CF_SAAS_API_TOKEN}`, 'Content-Type': 'application/json' },
        ...(hostname ? { body: JSON.stringify({ hostname, ssl: { method: 'txt', type: 'dv' } }) } : {})
    });
    const body = await rsp.json();
    if (!rsp.ok || body.success !== true || !body.result) {
        // Do not copy provider diagnostic or credentials to the client.
        const error = new Error('Cloudflare could not provision or verify the custom hostname.');
        error.code = rsp.status === 429 ? 503 : 502;
        throw error;
    }
    return body.result;
}
function domainDnsRecords(provider, cnameTarget) {
    const records = [{ type: 'CNAME', name: provider.hostname, value: cnameTarget }];
    const ownership = provider.ownership_verification;
    if (ownership?.type?.toLowerCase() === 'txt' && ownership.name && ownership.value)
        records.push({ type: 'TXT', name: ownership.name, value: ownership.value });
    for (const rec of provider.ssl?.validation_records || []) {
        if (rec.txt_name && rec.txt_value)
            records.push({ type: 'TXT', name: rec.txt_name, value: rec.txt_value });
    }
    return records;
}
async function dnsPointsToTarget(hostname, expected) {
    // v1 supports DNS-only CNAMEs. Proxied O2O records and apex domains need a
    // separately validated implementation; never silently classify them ready.
    const endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`;
    const rsp = await fetch(endpoint, { headers: { Accept: 'application/dns-json' } });
    if (!rsp.ok) return false;
    const body = await rsp.json();
    return body.Status === 0 && Array.isArray(body.Answer) && body.Answer.some(answer =>
        answer.type === 5 && String(answer.data || '').toLowerCase().replace(/\.$/, '') === expected);
}
async function presentDomain(kv, userId, record) {
    if (!record) return { domain: null };
    if (record.userId !== userId) return { domain: null };
    return { domain: { hostname: record.hostname, status: record.status || 'pending',
        hostnameStatus: record.hostnameStatus || 'pending', sslStatus: record.sslStatus || 'pending',
        dnsReady: record.dnsReady === true, records: Array.isArray(record.records) ? record.records : [],
        createdAt: record.createdAt || null } };
}
// Batch 20: the global domain registry is authoritative for ownership.
// Never fall back to KV if the registry fails or is unconfigured.
async function domainOperation(env, action, data = {}) {
    if (!env.DOMAIN_REGISTRY?.idFromName || !env.DOMAIN_REGISTRY?.get)
        throw new Error('Domain ownership registry not configured');
    const stub = env.DOMAIN_REGISTRY.get(env.DOMAIN_REGISTRY.idFromName('pixelping-global-domains-v1'));
    const rsp = await stub.fetch(new Request('https://domain-registry.internal/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data })
    }));
    let payload;
    try { payload = await rsp.json(); } catch { throw new Error('Invalid domain registry response'); }
    if (rsp.status >= 500) throw new Error('Domain ownership registry unavailable');
    return { status: rsp.status, ...payload };
}
async function currentDomainRecord(env, userId) {
    const result = await domainOperation(env, 'by-user', { userId });
    if (result.status !== 200) throw new Error('Domain ownership lookup failed');
    return result.record;
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // CORS Setup for Frontend Communication
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Private icon delivery reuses the existing signed account and entitlement checks.
        if (pathname === '/api/icons' || pathname.startsWith('/api/icons/')) {
            return servePrivateIcon(request, env,
                req => authorizeAccount(req, env, corsHeaders),
                userId => verifiedEvolutionAccess(env, userId));
        }

        // Versioned Terms and Privacy notice: acceptance is separate from QR/design data.
        if (pathname === '/api/terms') {
            const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
            if(!['GET','PUT'].includes(method))return respond({error:'Method not allowed.'},405);
            if(env.TERMS_STAGING_ENABLED!=='true')return respond({error:'Terms acceptance is not configured.'},503);
            if(method==='GET'&&!request.headers.get('Authorization'))return respond({success:true,owner:null,manifest:TERMS,accepted:false,acceptance:null});
            const auth=await authorizeAccount(request,env,corsHeaders);if(auth.response)return auth.response;
            if(!env.ACCOUNT_WORKSPACE?.idFromName||!env.ACCOUNT_WORKSPACE?.get)return respond({error:'Account storage is unavailable.'},503);
            try {
                let acceptance;
                if(method==='PUT'){
                    const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)return respond({error:'Request too large.'},413);
                    let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request.'},400)}
                    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['version','digest','terms','privacy'].includes(k)))return respond({error:'Invalid acknowledgment.'},400);
                    acceptance=body;
                }
                const stub=env.ACCOUNT_WORKSPACE.get(env.ACCOUNT_WORKSPACE.idFromName(auth.userId));
                const accountTerms=body=>stub.fetch(new Request('https://account-workspace.internal/terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:auth.userId,...body})}));
                const result=await accountTerms({acceptance});
                const data=await result.json();
                if(method==='GET'&&result.ok&&!data.accepted){
                    const signupEvidence=await verifiedSignupEvidence(auth,env);
                    if(signupEvidence){
                        const reconciled=await accountTerms({signupEvidence});
                        return respond(await reconciled.json(),reconciled.status);
                    }
                }
                return respond(data,result.status);
            }catch{return respond({error:'Acceptance could not be confirmed. Reconnect and try again.'},503)}
        }

        if(pathname==='/api/qr-names' || pathname==='/api/recovery-inventory') {
            const respond=(data,status=200)=>Response.json(data,{status,headers:{...corsHeaders,'Cache-Control':'no-store'}});
            if(!['GET','PUT'].includes(method)||pathname==='/api/recovery-inventory'&&method!=='GET')return respond({error:'Method not allowed.'},405);
            const auth=await authorizeAccount(request,env,corsHeaders);if(auth.response)return auth.response;
            if(!env.ACCOUNT_WORKSPACE?.get)return respond({error:'Account storage is unavailable.'},503);
            try{
                if(pathname==='/api/recovery-inventory'){
                    const query=(url.searchParams.get('q')||'').trim().toLowerCase();
                    const requested=Number(url.searchParams.get('page')||1);
                    if(query.length>160||!Number.isSafeInteger(requested)||requested<1)return respond({error:'Invalid search or page.'},400);
                    const all=await namedRoutes(env,auth.userId,await getOwnedLiveLinks(env,auth.userId));
                    const found=all.filter(x=>(x.friendlyName+' '+x.slug+' '+(x.destination||'')+' '+(x.brand?.businessName||'')).toLowerCase().includes(query));
                    const pages=Math.max(1,Math.ceil(found.length/10)),page=Math.min(requested,pages);
                    return respond({success:true,total:all.length,matches:found.length,page,pages,items:found.slice((page-1)*10,page*10).map(x=>({slug:x.slug,name:x.friendlyName,kind:x.kind||'link'}))});
                }
                let operation;
                if(method==='PUT'){
                    if(auth.metadata.masterKeyOwned!==true && !(auth.metadata.tier==='evolution' && await verifiedEvolutionAccess(env,auth.userId)))return respond({error:'Paid access is required to rename a QR.'},403);
                    const raw=await request.text();if(new TextEncoder().encode(raw).length>2048)return respond({error:'Name request too large.'},413);
                    try{operation=JSON.parse(raw)}catch{return respond({error:'Invalid name request.'},400)}
                    if(!operation || typeof operation!=='object' || Array.isArray(operation) || Object.keys(operation).some(x=>!['key','name','expectedRevision'].includes(x)))return respond({error:'Invalid name request.'},400);
                    if(typeof operation.key==='string'&&operation.key.startsWith('route:')){
                        const route=await routeOperation(env,'read',operation.key.slice(6));
                        if(route.status!==200||route.route.userId!==auth.userId)return respond({error:'Route unavailable for this account.'},route.status===503?503:404);
                    }
                }
                const result=await accountQrNames(env,auth.userId,operation);
                return respond(await result.json(),result.status);
            }catch{return respond({error:'QR names or inventory are temporarily unavailable. Refresh to retry.'},503)}
        }

        // My Codes uses the existing account-owned durable namespace, in its own table.
        if (pathname === '/api/codes') {
            const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
            if (!['GET','PUT'].includes(method)) return respond({error:'Method not allowed.'},405);
            const auth=await authorizeAccount(request,env,corsHeaders);
            if(auth.response)return auth.response;
            // Former subscribers can still identify/read their own retained designs.
            if(method==='PUT' && auth.metadata.masterKeyOwned!==true &&
                !(auth.metadata.tier==='evolution' && await verifiedEvolutionAccess(env,auth.userId)))
                return respond({error:'Master Key or active Evolution required to change saved designs.'},403);
            if(!env.ACCOUNT_WORKSPACE?.idFromName || !env.ACCOUNT_WORKSPACE?.get)return respond({error:'Account storage is unavailable.'},503);
            try {
                let operation;
                if(method==='PUT'){
                    const raw=await request.text();
                    if(new TextEncoder().encode(raw).length>131072)return respond({error:'Saved design is too large.'},413);
                    let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request.'},400)}
                    if(body.userId && body.userId!==auth.userId)return respond({error:'Account mismatch.'},403);
                    if(!body.operation)return respond({error:'Save operation required.'},400);
                    operation=body.operation;
                }
                const stub=env.ACCOUNT_WORKSPACE.get(env.ACCOUNT_WORKSPACE.idFromName(auth.userId));
                const response=await stub.fetch(new Request('https://account-workspace.internal/codes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:auth.userId,operation})}));
                return respond(await response.json(),response.status);
            }catch{return respond({error:'My Codes is temporarily unavailable.'},503)}
        }

        // Both paid tiers can synchronize saved generator data; ownership is server-derived.
        if (pathname === '/api/workspace') {
            const respond = (data, status = 200) => new Response(JSON.stringify(data), {
                status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
            });
            if (!['GET', 'PUT'].includes(method)) return respond({ error: 'Method not allowed.' }, 405);
            const auth = await authorizeAccount(request, env, corsHeaders);
            if (auth.response) return auth.response;
            if (auth.metadata.masterKeyOwned !== true &&
                !(auth.metadata.tier === 'evolution' && await verifiedEvolutionAccess(env, auth.userId))) {
                return respond({ error: 'Master Key or active Evolution required.' }, 403);
            }
            if (!env.ACCOUNT_WORKSPACE?.idFromName || !env.ACCOUNT_WORKSPACE?.get)
                return respond({ error: 'Account sync is not configured.' }, 503);
            try {
                let body = {};
                if (method === 'PUT') {
                    const raw = await request.text();
                    if (new TextEncoder().encode(raw).length > 131072)
                        return respond({ error: 'Saved code is too large to sync.' }, 413);
                    try { body = JSON.parse(raw); } catch { return respond({ error: 'Invalid request.' }, 400); }
                    if (body.userId && body.userId !== auth.userId) return respond({ error: 'Account mismatch.' }, 403);
                    if (!body.operation) return respond({ error: 'Save operation required.' }, 400);
                }
                const stub = env.ACCOUNT_WORKSPACE.get(env.ACCOUNT_WORKSPACE.idFromName(auth.userId));
                const response = await stub.fetch(new Request('https://account-workspace.internal/', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.userId, operation: body.operation })
                }));
                return respond(await response.json(), response.status);
            } catch { return respond({ error: 'Account sync temporarily unavailable.' }, 503); }
        }

        // --- STATIC PAGE BYPASS ---
        if (method === "GET" && (pathname.endsWith(".html") || pathname === "/admin" || pathname === "/help")) {
            return fetch(request); 
        }

        try {
            // ==========================================
            // ROUTE 1: INCOMING FRONTEND REQUESTS (POST)
            // ==========================================
            if (method === "POST" && pathname === "/") {
                const body = await request.json();

                // --- A. MIGRATE EXISTING PURCHASE KEYS TO SIGNED OFFLINE RECEIPTS ---
                if (body.licenseKey !== undefined) {
                    if (typeof body.licenseKey !== 'string' ||
                        !/^PP-[A-Z0-9-]{8,100}$/.test(body.licenseKey.trim().toUpperCase())) {
                        return new Response(JSON.stringify({ success: false, error: 'Invalid license key format.' }), {
                            status: 400, headers: corsHeaders });
                    }
                    const auth = await authorizeAccount(request, env, corsHeaders);
                    if (auth.response) return auth.response;
                    const submittedKey = body.licenseKey.trim().toUpperCase();
                    const stripeKeyData = await env.PIXELPING_KV.get(submittedKey);
                    let license = null;
                    try { license = stripeKeyData ? JSON.parse(stripeKeyData) : null; }
                    catch (_) { /* malformed record fails closed */ }
                    if (!license || license.tier !== 'master-key') {
                        return new Response(JSON.stringify({ success: false,
                            error: 'No permanent Master Key purchase matches this key.' }), {
                            status: 403, headers: corsHeaders });
                    }
                    if (license.userId !== auth.userId) {
                        return new Response(JSON.stringify({ success: false,
                            error: 'Sign in with the purchasing account. Older guest keys require support migration.' }), {
                            status: 403, headers: corsHeaders });
                    }
                    if (!env.OFFLINE_LICENSE_SIGNING_PKCS8) {
                        return new Response(JSON.stringify({ success: false,
                            error: 'Offline activation is not configured yet.' }), {
                            status: 503, headers: corsHeaders });
                    }
                    const receipt = await issueSignedMasterKeyReceipt(env, submittedKey, license);
                    return new Response(JSON.stringify({ success: true, receipt }), {
                        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                // Legacy email-only verification is not account authentication.
                if (body.evoEmail) {
                    return new Response(JSON.stringify({ success: false,
                        error: "Sign in with the subscribed account to verify Evolution." }), {
                        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                // --- B. THE DYNAMIC LINK BUILDER ---
                if (body.slug && body.destination) {
                    const auth = await authorizeEvolution(request, env, corsHeaders);
                    if (auth.response) return auth.response;
                    if (body.userId && body.userId !== auth.userId) {
                        return new Response(JSON.stringify({ error: "Account mismatch." }), { status: 403, headers: corsHeaders });
                    }
                    const destination = safeRouteDestination(body.destination);
                    if (!validSlug(body.slug) || !destination) {
                        return new Response(JSON.stringify({ error: "Invalid slug or destination." }), { status: 400, headers: corsHeaders });
                    }
                    // Only the durable per-slug registry can grant new ownership.
                    // Cloudflare KV get+put is not an atomic uniqueness guarantee.
                    const claimError = await claimRouteSlug(env, 'reserve', body.slug, auth.userId);
                    if (claimError) return new Response(JSON.stringify({ error: claimError.error }), {
                        status: claimError.status, headers: corsHeaders
                    });
                    const record = { slug: body.slug, destination, userId: auth.userId,
                        title: typeof body.title === "string" ? body.title.slice(0, 120) : body.slug,
                        type: typeof body.type === "string" ? body.type.slice(0, 32) : "LINK",
                        createdAt: new Date().toISOString(), clicks: 0 };
                    try {
                        await env.PIXELPING_KV.put(`link:${body.slug}`, JSON.stringify(record));
                        const published = await routeOperation(env, 'publish', body.slug, {
                            userId: auth.userId, route: record
                        });
                        if (published.status !== 200) throw new Error('Reserved route publication failed');
                    } catch (error) {
                        console.error('Reserved slug needs route-write reconciliation:', error.message);
                        return new Response(JSON.stringify({
                            error: 'Route creation could not be completed. Reservation is protected; contact support before retrying.'
                        }), { status: 503, headers: corsHeaders });
                    }
                    try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                        type: 'route.created', title: 'Dynamic QR created',
                        detail: `Created route /${body.slug}.`, category: 'qr'
                    }); } catch (err) { console.error('Activity recording failed:', err.message); }
                    return new Response(JSON.stringify({ success: true, slug: body.slug, revision: 0 }), { status: 200,
                        headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

            }

            // ==========================================
            // ROUTE 2: ADMIN DASHBOARD API
            // ==========================================
            if (pathname.startsWith("/api/")) {
                // Subscription and recovery information remains available AFTER
                // Evolution access ends, unlike paid route editing/telemetry.
                if (pathname === "/api/account-center" || pathname === "/api/account-center/read") {
                    const auth = await authorizeAccount(request, env, corsHeaders);
                    if (auth.response) return auth.response;
                    const respond = (body, status = 200) => new Response(JSON.stringify(body), {
                        status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
                    });
                    if (pathname === "/api/account-center/read" && method === "POST") {
                        const readAt = new Date().toISOString();
                        await env.PIXELPING_KV.put(`account-event-read:${auth.userId}`, readAt);
                        return respond({ success: true, readAt });
                    }
                    if (pathname === "/api/account-center" && method === "GET") {
                        const m = auth.metadata;
                        const periodEnd = Number.isInteger(m.evolutionCurrentPeriodEnd) ?
                            m.evolutionCurrentPeriodEnd : null;
                        let access, billingUnavailable = false;
                        try { access = await readEvolutionAccess(env, auth.userId); }
                        catch {
                            // A broken Evolution lookup must not revoke an independently
                            // verified lifetime Master Key from this authenticated account.
                            if (m.masterKeyOwned !== true) return respond({ error: 'Verified billing status is temporarily unavailable. Refresh to retry.' }, 503);
                            billingUnavailable = true;
                        }
                        const recovery = billingUnavailable ? { paidThrough: null, graceEndsAt: null,
                            archiveEndsAt: null, recoveryPhase: 'unavailable' } : evolutionRecovery(access, auth.userId);
                        const { paidThrough, graceEndsAt: graceEnd, archiveEndsAt: archiveEnd } = recovery;
                        const phase = !billingUnavailable && !access && !m.evolutionSubscriptionId ? 'none' : recovery.recoveryPhase;
                        const effectiveTier = phase === 'active' ? 'evolution' :
                            m.masterKeyOwned === true ? 'master-key' : 'free';
                        const [events, readAt, codes] = await Promise.all([
                            accountEvents(env.PIXELPING_KV, auth.userId),
                            env.PIXELPING_KV.get(`account-event-read:${auth.userId}`),
                            getOwnedLiveLinks(env, auth.userId)
                        ]);
                        const notice = recoveryNotice(recovery, access, auth.userId);
                        if (notice) {
                            // The currently relevant milestone replaces an older Cron
                            // copy of that same stage, without suppressing billing events.
                            const sameStage = new Set(['recovery.' + phase, 'recovery.suspended']);
                            if (phase !== 'grace') sameStage.delete('recovery.suspended');
                            for (let i = events.length - 1; i >= 0; i--)
                                if (sameStage.has(events[i].type)) events.splice(i, 1);
                            events.push(notice); events.sort((a,b) => b.at.localeCompare(a.at));
                        }
                        return respond({ success: true,
                            account: { tier: effectiveTier,
                                subscriptionStatus: typeof m.evolutionSubscriptionStatus === 'string' ?
                                    m.evolutionSubscriptionStatus : null,
                                cancelAtPeriodEnd: m.evolutionCancelAtPeriodEnd === true,
                                billingPeriodEnd: periodEnd,
                                paidThrough, graceEndsAt: graceEnd, archiveEndsAt: archiveEnd,
                                recoveryPhase: phase,
                                masterKeyOwned: m.masterKeyOwned === true },
                            policy: { graceDays: 30, archiveMonths: 12 },
                            events, readAt: readAt || null,
                            protectedCodes: { count: codes.length, items: codes
                                .sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                                .slice(0, 20).map(code => ({ slug: code.slug, title: code.title || code.slug })) },
                            // A deliberate activation flag prevents falsely claiming that
                            // provider emails are live before they have been configured/tested.
                            emailDeliveryConnected: env.EMAIL_NOTIFICATIONS_ENABLED === 'true' 
                        });
                    }
                    return respond({ error: "Method not allowed." }, 405);
                }
                if (pathname === '/api/domains') {
                    const auth = method === 'POST' ? await authorizeEvolution(request, env, corsHeaders) :
                        await authorizeAccount(request, env, corsHeaders);
                    if (auth.response) return auth.response;
                    const respond = (payload, status=200) => new Response(JSON.stringify(payload), {
                        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                    const target = domainSetupConfigured(env);
                    if (!target) return respond({ error: 'Custom domains are not configured on this deployment.' }, 503);
                    if (method === 'POST') {
                        let body;
                        try { body = await request.json(); } catch { return respond({ error: 'Invalid request.' }, 400); }
                        const hostname = normalizeCustomerHostname(body.domain);
                        if (!hostname) return respond({ error: 'Enter a valid subdomain, such as links.example.com. Apex/root domains are not supported.' }, 400);
                        let reserved;
                        try { reserved = await domainOperation(env, 'reserve', { hostname, userId: auth.userId }); }
                        catch { return respond({ error: 'Domain ownership service unavailable.' }, 503); }
                        if (reserved.status === 409) return respond({ error: 'This hostname or account already has a reserved domain.' }, 409);
                        if (reserved.status !== 201) return respond({ error: 'Unable to reserve this hostname.' }, 503);
                        let cf;
                        try { cf = await cfCustomHostname(env, 'POST', null, hostname); }
                        catch { return respond({ error: 'The hostname is reserved, but Cloudflare provisioning is incomplete. Contact support to reconcile the request.' }, 503); }
                        if (!cf.id || cf.hostname !== hostname) return respond({ error: 'Cloudflare returned an unexpected hostname. Reservation retained for reconciliation.' }, 502);
                        const record = { hostname, userId: auth.userId, cfId: cf.id,
                            createdAt: new Date().toISOString(), status: 'pending',
                            hostnameStatus: String(cf.status || 'pending'), sslStatus: String(cf.ssl?.status || 'pending'),
                            dnsReady: false, records: domainDnsRecords(cf, target) };
                        let committed;
                        try { committed = await domainOperation(env, 'commit', { hostname, userId: auth.userId, record }); }
                        catch { return respond({ error: 'Domain reserved; provider registration needs support reconciliation.' }, 503); }
                        if (committed.status !== 200) return respond({ error: 'Domain ownership could not be finalized.' }, 503);
                        // KV is a compatibility mirror, never ownership authority.
                        try {
                            await env.PIXELPING_KV.put(`custom-domain-host:${hostname}`, auth.userId);
                            await env.PIXELPING_KV.put(`custom-domain-user:${auth.userId}`, JSON.stringify(record));
                        } catch (err) { console.error('Custom-domain mirror write failed:', err.message); }
                        try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                            type:'domain.requested', title:'Custom domain requested',
                            detail:`Started verification for ${hostname}.`, category:'domain' }); }
                        catch (err) { console.error('Domain activity event failed:', err.message); }
                        return respond({ success: true, ...await presentDomain(env.PIXELPING_KV, auth.userId, record) }, 201);
                    }
                    if (method === 'GET') {
                        let record;
                        try { record = await currentDomainRecord(env, auth.userId); }
                        catch { return respond({ error: 'Domain ownership service temporarily unavailable.' }, 503); }
                        if (!record) return respond({ success: true, domain: null });
                        let cf;
                        try { cf = await cfCustomHostname(env, 'GET', record.cfId); }
                        catch (err) { return respond({ error:'Unable to check Cloudflare domain status.' }, 503); }
                        if (cf.id !== record.cfId || cf.hostname !== record.hostname)
                            return respond({ error:'Domain verification does not match the registered hostname.' }, 502);
                        let dnsReady = false;
                        try { dnsReady = await dnsPointsToTarget(record.hostname, target); }
                        catch (_) { /* DNS propagation or provider outage: fail closed */ }
                        const wasActive = record.status === 'active';
                        record.hostnameStatus = String(cf.status || 'pending');
                        record.sslStatus = String(cf.ssl?.status || 'pending');
                        record.dnsReady = dnsReady;
                        record.records = domainDnsRecords(cf, target);
                        record.status = cf.status === 'active' && cf.ssl?.status === 'active' && dnsReady ? 'active' : 'pending';
                        let updated;
                        try { updated = await domainOperation(env, 'status', { userId: auth.userId, record }); }
                        catch { return respond({ error: 'Domain verification could not be saved.' }, 503); }
                        if (updated.status !== 200) return respond({ error: 'Domain verification could not be saved.' }, 503);
                        try { await env.PIXELPING_KV.put(`custom-domain-user:${auth.userId}`, JSON.stringify(updated.record)); }
                        catch (err) { console.error('Custom-domain mirror update failed:', err.message); }
                        if (record.status === 'active' && !wasActive) {
                            try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                                type:'domain.activated', title:'Custom domain activated',
                                detail:`${record.hostname} is verified and routing is ready.`, category:'domain' }); }
                            catch (err) { console.error('Domain activity event failed:', err.message); }
                        }
                        if (record.status !== 'active' && wasActive) {
                            try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                                type:'domain.pending', title:'Custom domain verification requires attention',
                                detail:`${record.hostname} no longer meets all readiness checks.`, category:'domain' }); }
                            catch (err) { console.error('Domain activity event failed:', err.message); }
                        }
                        return respond({ success: true, ...await presentDomain(env.PIXELPING_KV, auth.userId, record) });
                    }
                    return respond({ error: 'Method not allowed.' }, 405);
                }
                if (!["/api/links", "/api/telemetry", "/api/actions"].includes(pathname)) {
                    return new Response(JSON.stringify({ error: "API Route Not Found" }), { status: 404, headers: corsHeaders });
                }
                const auth = await authorizeEvolution(request, env, corsHeaders);
                if (auth.response) return auth.response;
                const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
                    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
                const requestedUser = url.searchParams.get("userId");
                if (requestedUser && requestedUser !== auth.userId) return json({ error: "Account mismatch." }, 403);

                // Batch25: typed actions are separate from the existing web-write
                // contract. The authenticated identity is the only route owner.
                if (pathname === '/api/actions') {
                    if (method === 'GET') {
                        try {
                            const actions = await namedRoutes(env,auth.userId,(await getOwnedLiveLinks(env, auth.userId)).filter(link => link.mode === 'action'));
                            return json({ success: true, actions: actions.map(link => ({
                                slug: link.slug, title: link.title, friendlyName: link.friendlyName, nameRevision: link.nameRevision, kind: link.kind, action: link.action,
                                brand: link.brand, scans: link.clicks || 0, createdAt: link.createdAt
                            })) });
                        } catch { return json({ error: 'Unable to list actions.' }, 503); }
                    }
                    if (method === 'POST' || method === 'PUT') {
                        let body;
                        try {
                            // Bound bytes while reading, including chunked requests
                            // without a trustworthy Content-Length header.
                            const reader = request.body?.getReader();
                            if (!reader) return json({ error: 'Invalid request.' }, 400);
                            const decoder = new TextDecoder();
                            let raw = '', bytes = 0;
                            while (true) {
                                const chunk = await reader.read();
                                if (chunk.done) break;
                                bytes += chunk.value.byteLength;
                                if (bytes > 16384) {
                                    await reader.cancel();
                                    return json({ error: 'Action payload too large.' }, 413);
                                }
                                raw += decoder.decode(chunk.value, { stream: true });
                            }
                            raw += decoder.decode();
                            body = JSON.parse(raw);
                        } catch { return json({ error: 'Invalid request.' }, 400); }
                        if (!body || typeof body !== 'object' || Array.isArray(body) ||
                            Object.keys(body).some(key => !['slug', 'kind', 'action', 'brand', 'title'].includes(key)) ||
                            !validSlug(body.slug)) return json({ error: 'Invalid action request.' }, 400);
                        const { slug, ...rawContent } = body;
                        const content = validateSmartAction(rawContent);
                        if (!content) return json({ error: 'Invalid action fields.' }, 400);
                        if (method === 'POST') {
                            const claimError = await claimRouteSlug(env, 'reserve', slug, auth.userId);
                            if (claimError) return json({ error: claimError.error }, claimError.status);
                            const createdAt = new Date().toISOString();
                            const record = { slug, userId: auth.userId, schema: 3, mode: 'action', ...content, createdAt };
                            try {
                                await env.PIXELPING_KV.put(`link:${slug}`, JSON.stringify(record));
                                const published = await routeOperation(env, 'publish-action', slug, {
                                    userId: auth.userId, content, createdAt
                                });
                                if (published.status !== 200) throw new Error('Action publication failed');
                            } catch {
                                return json({ error: 'Action creation could not be completed. Reservation is protected; contact support before retrying.' }, 503);
                            }
                        } else {
                            const updated = await routeOperation(env, 'update-action', slug, { userId: auth.userId, content });
                            if (updated.status !== 200) return json({ error: updated.status === 403 ? 'Route not found.' : updated.error },
                                updated.status === 403 ? 404 : updated.status);
                        }
                        try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                            type: method === 'POST' ? 'route.created' : 'route.updated',
                            title: method === 'POST' ? 'Smart Action QR created' : 'Smart Action QR updated',
                            detail: `${method === 'POST' ? 'Created' : 'Updated'} route /${slug}.`, category: 'qr'
                        }); } catch { console.error('Smart action activity recording failed'); }
                        return json({ success: true, slug });
                    }
                    if (method === 'DELETE') {
                        const slug = url.searchParams.get('slug');
                        if (!validSlug(slug)) return json({ error: 'Invalid route.' }, 400);
                        const owned = await routeOperation(env, 'read', slug);
                        if (owned.status !== 200) return json({ error: 'Route unavailable.' }, owned.status === 404 ? 404 : 503);
                        if (owned.route.userId !== auth.userId || owned.route.mode !== 'action') return json({ error: 'Route not found.' }, 404);
                        const deleted = await routeOperation(env, 'tombstone', slug, { userId: auth.userId });
                        if (deleted.status !== 200) return json({ error: 'Unable to delete action.' }, deleted.status === 403 ? 404 : deleted.status);
                        try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                            type: 'route.deleted', title: 'Smart Action QR deleted', detail: `Deleted route /${slug}.`, category: 'qr'
                        }); } catch { console.error('Smart action deletion activity recording failed'); }
                        return json({ success: true });
                    }
                    return json({ error: 'Method not allowed.' }, 405);
                }

                if (pathname === "/api/links" && method === "GET") {
                    try {
                        const selectedSlug = url.searchParams.get('slug');
                        if (selectedSlug !== null) {
                            if (!validSlug(selectedSlug)) return json({ error: 'Invalid route.' }, 400);
                            const selected = await routeOperation(env, 'read', selectedSlug);
                            if (selected.status !== 200 || selected.route.userId !== auth.userId || selected.route.mode === 'action')
                                return json({ error: 'Saved web route unavailable.' }, selected.status === 503 ? 503 : 404);
                            const domain = await currentDomainRecord(env, auth.userId);
                            return json({ success: true, customDomain: domain?.status === 'active' ? domain.hostname : null,
                                link: { slug: selectedSlug, destination: selected.route.destination,
                                    revision: Number.isSafeInteger(selected.route.revision) ? selected.route.revision : 0,
                                    scans: selected.scans, createdAt: selected.route.createdAt } });
                        }
                        const links = await namedRoutes(env,auth.userId,(await getOwnedLiveLinks(env, auth.userId)).filter(link => link.mode !== 'action'));
                        const domain = await currentDomainRecord(env, auth.userId);
                        return json({ success: true, customDomain: domain?.status === 'active' ? domain.hostname : null, links: links.map(link => ({
                            slug: link.slug, title: link.title || link.slug, friendlyName: link.friendlyName, nameRevision: link.nameRevision, type: link.type || "LINK",
                            destination: link.destination, revision: Number.isSafeInteger(link.revision) ? link.revision : 0, scans: link.clicks || 0,
                            createdAt: link.createdAt
                        })) });
                    } catch { return json({ error: "Unable to list routes." }, 503); }
                }
                if (pathname === "/api/links" && method === "PUT") {
                    let body;
                    try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
                    const destination = safeRouteDestination(body.destination);
                    if (!validSlug(body.slug) || !destination) return json({ error: "Invalid route or destination." }, 400);
                    if (body.userId && body.userId !== auth.userId) return json({ error: "Account mismatch." }, 403);
                    const updated = await routeOperation(env, 'update', body.slug, {
                        userId: auth.userId, destination, expectedRevision: body.expectedRevision
                    });
                    if (updated.status !== 200) return json({ error: updated.status === 403 ? "Route not found." : updated.error },
                        updated.status === 403 ? 404 : updated.status);
                    try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                        type: 'route.updated', title: 'Dynamic QR destination updated',
                        detail: `Destination changed for /${body.slug}.`, category: 'qr'
                    }); } catch (err) { console.error('Activity recording failed:', err.message); }
                    return json({ success: true, revision: updated.revision });
                }
                if (pathname === "/api/links" && method === "DELETE") {
                    const slug = url.searchParams.get("slug");
                    if (!validSlug(slug)) return json({ error: "Invalid route." }, 400);
                    const deleted = await routeOperation(env, 'tombstone', slug, { userId: auth.userId });
                    if (deleted.status !== 200) return json({ error: deleted.status === 403 ? "Route not found." : deleted.error },
                        deleted.status === 403 ? 404 : deleted.status);
                    try { await recordAccountEvent(env.PIXELPING_KV, auth.userId, {
                        type: 'route.deleted', title: 'Dynamic QR deleted',
                        detail: `Deleted route /${slug}.`, category: 'qr'
                    }); } catch (err) { console.error('Activity recording failed:', err.message); }
                    return json({ success: true });
                }
                if (pathname === "/api/telemetry" && method === "GET") {
                    try {
                        const links = await getOwnedLiveLinks(env, auth.userId);
                        const pings = links.reduce((sum, link) => sum + (Number(link.clicks) || 0), 0);
                        const top = links.reduce((a, link) => (Number(link.clicks) || 0) > (Number(a?.clicks) || 0) ? link : a, null);
                        return json({ success: true, telemetry: {
                            pings, activeRoutes: links.length, topLink: top ? `/${top.slug}` : "/none"
                        } });
                    } catch { return json({ error: "Aggregation failed." }, 503); }
                }
                return json({ error: "Method Not Allowed" }, 405);
            }

            // ==========================================
            // ROUTE 3: THE QR REDIRECT & TELEMETRY ENGINE
            // ==========================================
            const slug = pathname.substring(1); 
            
            if (!slug) {
                return new Response("PixelPing Edge Network Online.", { status: 200, headers: corsHeaders });
            }

            // Keep the canonical PixelPing routes working. A customer hostname
            // is authorized only for the user who registered and verified it.
            const host = url.hostname.toLowerCase();
            const defaultHosts = new Set(['pixelping-worker.amateuraiguy.workers.dev',
                'link.pixelping.app', 'proxy.pixelping.app',
                ...String(env.DEFAULT_ROUTING_HOSTS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)]);
            let domainOwner = null;
            if (!defaultHosts.has(host)) {
                // An unconfigured SaaS zone must never turn arbitrary Host
                // headers into canonical PixelPing redirects.
                if (!domainSetupConfigured(env)) return new Response('Custom domain not configured.', { status: 404 });
                let lookup;
                try { lookup = await domainOperation(env, 'by-host', { hostname: host }); }
                catch { return new Response('Domain ownership service unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
                if (lookup.status !== 200) return new Response('Domain ownership unavailable.', { status: 503 });
                const domain = lookup.record;
                if (!domain) return new Response('Custom domain not configured.', { status: 404 });
                domainOwner = domain.userId;
                if (domain.hostname !== host || domain.status !== 'active')
                    return new Response('Custom domain awaiting verification.', { status: 421 });
            }
            if (!validSlug(slug)) return new Response('404: Invalid route.', { status: 404, headers: corsHeaders });
            const lookup = await routeOperation(env, 'read', slug);
            if (lookup.status !== 200) return new Response('Route unavailable.', {
                status: lookup.status === 404 ? 404 : 503,
                headers: { ...corsHeaders, 'Cache-Control': 'no-store' }
            });
            const record = lookup.route;
            if (domainOwner && record.userId !== domainOwner)
                return new Response('Route not found for this hostname.', { status: 404 });
            let access;
            try { access = await readEvolutionAccess(env, record.userId); }
            catch { return new Response('QR service temporarily unavailable. Please try again later.', {
                status: 503, headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'Retry-After': '60' }
            }); }
            const recovery = evolutionRecovery(access, record.userId);
            if (!record.userId || recovery.recoveryPhase !== 'active') {
                const uncertain = recovery.recoveryPhase === 'unverified';
                return new Response(uncertain ? 'QR service temporarily unavailable. Please try again later.' :
                    'This QR code is temporarily inactive. Please contact the person or business that provided it.', {
                    status: 503, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-store', 'Retry-After': uncertain ? '60' : '3600' }
                });
            }
            // Count and read the current destination in one DO operation. If
            // someone deletes or edits while entitlement is checked, this
            // operation observes the latest committed route (or returns 404).
            const scan = await routeOperation(env, 'scan', slug);
            if (scan.status !== 200) return new Response('Route unavailable.', {
                status: scan.status === 404 ? 404 : 503,
                headers: { ...corsHeaders, 'Cache-Control': 'no-store' }
            });
            if (scan.route.userId !== record.userId || (domainOwner && scan.route.userId !== domainOwner))
                return new Response('Route unavailable.', { status: 503, headers: corsHeaders });
            if (scan.route.mode === 'action') return renderSmartAction(scan.route);
            return new Response(null, { status: 302, headers: {
                Location: scan.route.destination, 'Cache-Control': 'no-store', ...corsHeaders
            }});

        } catch (error) {
            console.error("Worker Error:", error);
            return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { 
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }
};
