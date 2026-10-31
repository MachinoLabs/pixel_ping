import { ICON_HASHES } from './icon_manifest.js';

// This endpoint has no listing, ZIP, upload or arbitrary-object operation.
// Catalog IDs are public metadata; vector artwork is served one selection at a time.
export async function servePrivateIcon(request, env, authorize, evolutionAccess) {
    const origin = request.headers.get('Origin');
    const appOrigin = 'https://pixelping.app';
    const headers = {
        'Access-Control-Allow-Origin': appOrigin,
        'Access-Control-Expose-Headers': 'Retry-After',
        'Cache-Control': 'private, no-store', Vary: 'Origin',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin'
    };
    const fail = (error, status, extra = {}) => new Response(JSON.stringify({ error }), {
        status, headers: { ...headers, 'Content-Type': 'application/json', ...extra }
    });
    if (origin && origin !== appOrigin) return fail('Origin not allowed.', 403);
    if (request.method !== 'GET') return fail('Method not allowed.', 405, { Allow: 'GET' });
    const match = /^\/api\/icons\/v1\/([a-z0-9]+(?:-[a-z0-9]+)*)\.(svg|png)$/.exec(new URL(request.url).pathname);
    if (!match || !Object.hasOwn(ICON_HASHES, match[1]) ||
        (match[1] === 'preview' ? match[2] !== 'png' : match[2] !== 'svg')) return fail('Icon not found.', 404);
    if (!env.PRIVATE_ICONS?.get || !env.ICON_IP_LIMITER?.limit || !env.ICON_USER_LIMITER?.limit)
        return fail('Icon library is temporarily unavailable.', 503);
    try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!(await env.ICON_IP_LIMITER.limit({ key: 'pp-icons-v1:ip:' + ip })).success)
            return fail('Too many icon requests. Please try again shortly.', 429, { 'Retry-After': '60' });
        const auth = await authorize(request);
        if (auth.response) {
            return new Response(auth.response.body, { status: auth.response.status,
                headers: { ...headers, 'Content-Type': 'application/json' } });
        }
        if (auth.metadata.masterKeyOwned !== true &&
            !(auth.metadata.tier === 'evolution' && await evolutionAccess(auth.userId)))
            return fail('Master Key or active Evolution required.', 403);
        if (!(await env.ICON_USER_LIMITER.limit({ key: 'pp-icons-v1:user:' + auth.userId })).success)
            return fail('Too many icon requests. Please try again shortly.', 429, { 'Retry-After': '60' });
        const object = await env.PRIVATE_ICONS.get(`v1/${match[1]}.${match[2]}`);
        if (!object || object.size > 262144) return fail('Icon is temporarily unavailable.', 503);
        const bytes = await object.arrayBuffer();
        if (bytes.byteLength > 262144) return fail('Icon is temporarily unavailable.', 503);
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
            b => b.toString(16).padStart(2, '0')).join('');
        if (digest !== ICON_HASHES[match[1]]) return fail('Icon could not be verified.', 503);
        return new Response(bytes, { headers: { ...headers,
            'Content-Type': match[2] === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png' } });
    } catch (error) {
        console.error('Private icon request failed:', error.message);
        return fail('Icon library is temporarily unavailable.', 503);
    }
}
