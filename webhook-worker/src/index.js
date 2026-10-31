import Stripe from 'stripe';
import { queueNotice, deliverNotices, verifyResendWebhook, recordDeliveryCallback } from './notification_delivery.js';

// Checkout-only authorization. Never accept a browser-supplied Clerk user ID as proof.
// Requires CLERK_ISSUER_URL and CLERK_SECRET_KEY in this Worker's environment.
function fromBase64Url(value) {
    const text = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    return Uint8Array.from(text, c => c.charCodeAt(0));
}

async function authenticatedUser(request, env) {
    if (!env.CLERK_ISSUER_URL || !env.CLERK_SECRET_KEY) return { error: 'Authentication is not configured.', status: 503 };
    const auth = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') || '');
    if (!auth) return { error: 'Sign in to continue.', status: 401 };
    try {
        const issuer = env.CLERK_ISSUER_URL.replace(/\/$/, '');
        if (!issuer.startsWith('https://')) return { error: 'Authentication is not configured.', status: 503 };
        const parts = auth[1].split('.');
        if (parts.length !== 3) return { error: 'Invalid session.', status: 401 };
        const head = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
        const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1])));
        const now = Math.floor(Date.now() / 1000);
        if (head.alg !== 'RS256' || !head.kid || claims.iss !== issuer ||
            typeof claims.sub !== 'string' || !claims.sub.startsWith('user_') ||
            !Number.isInteger(claims.exp) || claims.exp <= now ||
            (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 30)) ||
            (claims.iat !== undefined && (!Number.isInteger(claims.iat) || claims.iat > now + 30))) {
            return { error: 'Invalid or expired session.', status: 401 };
        }
        const jwksResponse = await fetch(`${issuer}/.well-known/jwks.json`);
        if (!jwksResponse.ok) throw new Error('Could not load signing keys');
        const jwks = await jwksResponse.json();
        const key = jwks.keys?.find(k => k.kid === head.kid && k.kty === 'RSA' &&
            (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
        if (!key) return { error: 'Unknown session signing key.', status: 401 };
        const cryptoKey = await crypto.subtle.importKey('jwk', key,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey,
            fromBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
        if (!valid) return { error: 'Invalid session signature.', status: 401 };
        const userResponse = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(claims.sub)}`, {
            headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` }
        });
        if (!userResponse.ok) throw new Error('Could not verify account');
        const user = await userResponse.json();
        if (user.id !== claims.sub) return { error: 'Account mismatch.', status: 401 };
        return { userId: claims.sub };
    } catch (err) {
        console.error('Checkout authentication failed:', err.message);
        return { error: 'Unable to verify account.', status: 503 };
    }
}

const PRODUCTS = {
    'price_1U85qDIZcbLigL0N6FImW5v6': { tier: 'master-key', mode: 'payment' },
    'price_1U87KcIZcbLigL0Nou9BMy4z': { tier: 'evolution', mode: 'subscription' }
};

function productFor(priceId, mode) {
    const p = PRODUCTS[priceId];
    return p && p.mode === mode ? p : null;
}


// Subscription access is based on the CURRENT Stripe subscription, never an old
// event snapshot. Active/trialing retain access, including scheduled cancellation
// until the subscription actually ends. Other statuses are non-entitled.
function evolutionEligible(status) {
    return status === 'active' || status === 'trialing';
}

async function recordStripeAccountEvent(env, userId, event, description) {
    // Same Stripe event ID always maps to the same account log key.
    const occurredAt = new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const stamp = new Date(occurredAt).getTime().toString().padStart(13, '0');
    const key = `account-event:${userId}:${stamp}:stripe-${event.id}`;
    await env.PIXELPING_KV.put(key, JSON.stringify({
        id: event.id, at: occurredAt, type: event.type, category: 'billing',
        title: description.title, detail: description.detail, notify: true
    }));
    await queueNotice(env.PIXELPING_KV, userId, key, event.id);
}

function describeSubscriptionEvent(event, subscription) {
    const kind = event.type;
    if (kind === 'invoice.payment_failed') return {
        title: 'Subscription payment needs attention',
        detail: 'Stripe reported a failed payment. Review your billing method to avoid losing dynamic QR access.'
    };
    if (kind === 'invoice.paid') return {
        title: 'Subscription payment recorded', detail: 'Stripe confirmed an invoice payment.'
    };
    if (subscription.cancel_at_period_end && (subscription.status === 'active' || subscription.status === 'trialing')) return {
        title: 'Evolution cancellation scheduled',
        detail: 'Your subscription is scheduled to end at the end of its paid period.'
    };
    if (subscription.status === 'active' || subscription.status === 'trialing') return {
        title: 'Evolution subscription active', detail: 'Stripe currently reports an active Evolution subscription.'
    };
    return { title: 'Evolution subscription status changed',
        detail: `Stripe reports subscription status: ${String(subscription.status).slice(0, 32)}.` };
}

async function getClerkAccount(env, userId) {
    const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` }
    });
    if (!response.ok) throw new Error(`Clerk lookup failed (${response.status})`);
    const account = await response.json();
    if (account.id !== userId) throw new Error('Clerk account mismatch');
    return account;
}

async function updateClerkMetadata(env, userId, metadata) {
    const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/metadata`, {
        method: 'PATCH', headers: {
            Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json'
        }, body: JSON.stringify({ public_metadata: metadata })
    });
    if (!response.ok) throw new Error(`Clerk update failed (${response.status})`);
}

async function reconcileEvolutionSubscription(env, subscription, knownUserId = null, stripe = null, eventInvoice = null) {
    const subId = subscription?.id;
    if (typeof subId !== 'string' || !subId.startsWith('sub_')) throw new Error('Invalid subscription ID');
    const key = `subscription:${subId}`;
    const raw = await env.PIXELPING_KV.get(key);
    const existing = raw ? JSON.parse(raw) : null;
    const metadataUserId = subscription.metadata?.clerkUserId || null;
    const userId = knownUserId || existing?.userId || metadataUserId;
    if (!userId) return { unmapped: true }; // Older subscriptions need a one-time backfill.
    if (!userId.startsWith('user_') ||
        (existing?.userId && existing.userId !== userId) ||
        (metadataUserId && metadataUserId !== userId)) {
        throw new Error('Subscription account mismatch');
    }
    const account = await getClerkAccount(env, userId);
    const previous = account.public_metadata || {};
    // Only successfully paid invoice lines extend entitlement, not Stripe status
    // or a current_period_end that can advance on an unpaid renewal.
    const observedPaidThrough = await confirmedSubscriptionPaidThrough(stripe, subscription, eventInvoice);
    const priorPaidThrough = existing?.userId === userId && Number.isInteger(existing.paidThrough) ?
        existing.paidThrough : null;
    const paidThrough = Math.max(observedPaidThrough || 0, priorPaidThrough || 0) || null;
    const isActive = recoveryPhase(paidThrough) === 'active';
    const masterOwned = previous.masterKeyOwned === true ||
        (previous.tier === 'master-key' && !previous.evolutionSubscriptionId);
    // Old sub updates must not revoke or reassign a newer linked subscription.
    const linkedElsewhere = previous.evolutionSubscriptionId &&
        previous.evolutionSubscriptionId !== subId;
    // A newly purchased paid subscription can restore an account whose previous
    // subscription period has already ended. An old delayed checkout may not
    // displace a still-paid, newer subscription.
    const replacesExpired = linkedElsewhere && knownUserId === userId && isActive &&
        (!Number.isInteger(previous.evolutionPaidThrough) ||
            previous.evolutionPaidThrough <= Math.floor(Date.now() / 1000));
    const next = { ...previous };
    if (!linkedElsewhere || replacesExpired) {
        if (isActive) {
            next.evolutionSubscriptionId = subId;
            next.tier = 'evolution';
        } else if (previous.evolutionSubscriptionId === subId) {
            next.tier = masterOwned ? 'master-key' : 'free';
        }
        if (next.evolutionSubscriptionId === subId) {
            next.evolutionSubscriptionStatus = subscription.status;
            next.evolutionCancelAtPeriodEnd = subscription.cancel_at_period_end === true;
            next.evolutionCurrentPeriodEnd = Number.isInteger(subscription.current_period_end) ?
                subscription.current_period_end : null;
            next.evolutionPaidThrough = paidThrough;
        }
        next.masterKeyOwned = masterOwned;
        await updateClerkMetadata(env, userId, next);
        // The redirect engine reads this account-scoped paid invoice evidence;
        // if missing, fail closed rather than accepting stale browser tier flags.
        await env.PIXELPING_KV.put(`account-access:${userId}`, JSON.stringify({
            userId, subscriptionId: subId, paidThrough, status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
            updatedAt: new Date().toISOString()
        }));
    }
    // Recording the subscription after the Clerk PATCH means retries repair failures.
    await env.PIXELPING_KV.put(key, JSON.stringify({
        userId, status: subscription.status, customerId: typeof subscription.customer === 'string' ?
            subscription.customer : subscription.customer?.id || null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        currentPeriodEnd: Number.isInteger(subscription.current_period_end) ?
            subscription.current_period_end : null,
        paidThrough,
        updatedAt: new Date().toISOString()
    }));
    return { userId, isActive, paidThrough, linkedElsewhere: Boolean(linkedElsewhere && !replacesExpired) };
}

// Evolution recovery: never extend service merely from current_period_end or status.
// A Stripe-paid invoice's subscription-line service interval is authoritative.
const GRACE_SECONDS = 30 * 86400;
function archiveDeadline(graceEndSeconds) {
    const date = new Date(graceEndSeconds * 1000);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 12);
    const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, maxDay));
    return Math.floor(date.getTime() / 1000);
}
function recoveryPhase(paidThrough, now = Math.floor(Date.now() / 1000)) {
    if (!Number.isInteger(paidThrough) || paidThrough <= 0) return 'unverified';
    if (now < paidThrough) return 'active';
    if (now < paidThrough + GRACE_SECONDS) return 'grace';
    if (now < archiveDeadline(paidThrough + GRACE_SECONDS)) return 'archived';
    return 'deletion-eligible'; // Never automatically delete or release old slugs.
}
async function paidInvoicePeriodEnd(stripe, invoiceOrId, subscriptionId) {
    if (!invoiceOrId || !stripe) return null;
    const invoice = typeof invoiceOrId === 'string' ?
        await stripe.invoices.retrieve(invoiceOrId) : invoiceOrId;
    const ref = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (ref !== subscriptionId || (invoice.status !== 'paid' && invoice.paid !== true)) return null;
    let lines = invoice.lines?.data || [];
    if (invoice.lines?.has_more || !lines.length) {
        const listed = await stripe.invoices.listLineItems(invoice.id, { limit: 100 });
        lines = listed.data || [];
    }
    const ends = lines.filter(line =>
        line.type === 'subscription' || line.subscription_item ||
        (line.price?.recurring && line.period))
        .map(line => line.period?.end)
        .filter(value => Number.isInteger(value) && value > 0);
    return ends.length ? Math.max(...ends) : null;
}
async function confirmedSubscriptionPaidThrough(stripe, subscription, eventInvoice = null) {
    const candidates = [];
    if (eventInvoice) candidates.push(await paidInvoicePeriodEnd(stripe, eventInvoice, subscription.id));
    if (subscription.latest_invoice) candidates.push(await paidInvoicePeriodEnd(stripe, subscription.latest_invoice, subscription.id));
    const verified = candidates.filter(x => Number.isInteger(x) && x > 0);
    return verified.length ? Math.max(...verified) : null;
}
async function recordLifecycleNotice(env, userId, subscriptionId, milestone, paidThrough, title, detail, now) {
    const eventId = `lifecycle-${subscriptionId}-${paidThrough}-${milestone}`;
    const key = `account-event:${userId}:${String(now * 1000).padStart(13,'0')}:${eventId}`;
    // Avoid duplicate notices on Cron retries and repeated daily runs.
    const marker = `lifecycle-notice:${eventId}`;
    if (await env.PIXELPING_KV.get(marker)) return false;
    await env.PIXELPING_KV.put(key, JSON.stringify({ id: eventId,
        at: new Date(now * 1000).toISOString(), type: `recovery.${milestone}`,
        category: 'billing', title, detail, notify: true }));
    await queueNotice(env.PIXELPING_KV, userId, key, eventId);
    await env.PIXELPING_KV.put(marker, '1');
    return true;
}
async function sweepRecovery(env, now = Math.floor(Date.now() / 1000)) {
    if (!env.PIXELPING_KV) throw new Error('KV binding is unavailable');
    let cursor, pages = 0, seen = 0, recorded = 0;
    do {
        const page = await env.PIXELPING_KV.list({ prefix: 'account-access:', ...(cursor ? { cursor } : {}) });
        for (const entry of page.keys) {
            const raw = await env.PIXELPING_KV.get(entry.name);
            if (!raw) continue;
            const a = JSON.parse(raw);
            if (a.userId !== entry.name.slice('account-access:'.length) ||
                !a.subscriptionId || !Number.isInteger(a.paidThrough)) continue;
            seen++;
            const through = a.paidThrough;
            if (now >= through) {
                const account = await getClerkAccount(env, a.userId);
                const m = account.public_metadata || {};
                // Only downgrade this same subscription, never a newer renewal.
                if (m.evolutionSubscriptionId === a.subscriptionId && m.tier === 'evolution') {
                    await updateClerkMetadata(env, a.userId, { ...m,
                        tier: m.masterKeyOwned === true ? 'master-key' : 'free' });
                }
            }
            const graceEnd = through + GRACE_SECONDS;
            const archiveEnd = archiveDeadline(graceEnd);
            const milestones = [
                ['paid-7d', through - 7*86400, through - 6*86400, 'Evolution renewal approaching',
                    'Your verified paid-through date is approaching. Review your payment method to keep dynamic QR routing active.'],
                ['paid-1d', through - 86400, through, 'Evolution access ends soon',
                    'Unless another billing period is paid, your dynamic QR redirects will pause at the paid-through date.'],
                ['suspended', through, through + 86400, 'Dynamic QR redirects suspended',
                    'Your paid period ended. The QR destinations and slugs are preserved; renew to reactivate without reprinting.'],
                ['grace-15d', graceEnd - 15*86400, graceEnd - 14*86400, 'Evolution grace period halfway through',
                    'Your dynamic QR records remain recoverable. Renew before the grace period ends to avoid archival.'],
                ['grace-1d', graceEnd - 86400, graceEnd, 'Evolution archive begins soon',
                    'Your 30-day grace period is ending. Your saved QR records will remain recoverable during the archive.'],
                ['archived', graceEnd, graceEnd + 86400, 'Dynamic QR records archived',
                    'Your QR slugs, destinations and saved scan records are preserved for a further 12 months.'],
                ['archive-30d', archiveEnd - 30*86400, archiveEnd - 29*86400, 'Archived QR recovery deadline approaching',
                    'Your archived QR records are approaching deletion eligibility. Renew or contact support to preserve them.'],
                ['archive-7d', archiveEnd - 7*86400, archiveEnd - 6*86400, 'Archive recovery deadline in one week',
                    'Review your archived dynamic QR codes before they become eligible for deletion.'],
                ['deletion-eligible', archiveEnd, Number.POSITIVE_INFINITY, 'Archived QR records require review',
                    'The archive retention period has ended. No QR records are deleted automatically; contact support to recover them.']
            ];
            // Each milestone has its own scheduled window. We do not send older
            // reminders late, or flood the customer with several overdue messages.
            for (const [id, start, finish, title, detail] of milestones) {
                if (now >= start && now < finish) {
                    if (await recordLifecycleNotice(env,a.userId,a.subscriptionId,id,through,title,detail,now)) recorded++;
                }
            }
        }
        cursor = page.list_complete === false ? page.cursor : null;
        if (++pages > 100) throw new Error('Recovery sweep exceeded safe KV pagination limit');
    } while (cursor);
    return { examined: seen, noticesRecorded: recorded };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature'
        };
        const respond = (value, status = 200) => new Response(JSON.stringify(value), {
            status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        // Resend delivery callbacks are NEVER processed through the Stripe webhook handler.
        if (request.method === 'POST' && url.pathname === '/resend-webhook') {
            if (!env.RESEND_WEBHOOK_SECRET || !env.PIXELPING_KV) return respond({ error: 'Email callbacks not configured.' }, 503);
            const raw = await request.text();
            if (!await verifyResendWebhook(request, env.RESEND_WEBHOOK_SECRET, raw)) {
                return respond({ error: 'Invalid email callback signature.' }, 401);
            }
            try {
                return respond(await recordDeliveryCallback(env.PIXELPING_KV, JSON.parse(raw)));
            } catch (err) {
                console.error('Resend delivery callback failed:', err.message);
                return respond({ error: 'Email callback temporarily unavailable.' }, 503);
            }
        }
        if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

        // Neither verification endpoint reveals a license or unlocks an account
        // unless the signed-in Clerk user actually owns the paid checkout.
        if ((request.method === 'GET' && url.pathname === '/verify') ||
            (request.method === 'POST' && url.pathname === '/verify-session')) {
            const verifyResponse = (value, status = 200) => {
                const response = respond(value, status);
                response.headers.set('Cache-Control', 'no-store');
                return response;
            };
            const pending = () => verifyResponse({ valid: false, pending: true,
                retryable: true, code: 'CHECKOUT_PENDING', retryAfter: 3,
                error: 'Checkout activation is still processing.' }, 202);
            const reject = (error, status = 403) => verifyResponse({ valid: false,
                retryable: false, code: 'CHECKOUT_REJECTED', error }, status);
            const auth = await authenticatedUser(request, env);
            if (auth.error) return verifyResponse({ valid: false, error: auth.error,
                retryable: auth.status === 503, code: auth.status === 503 ? 'VERIFICATION_UNAVAILABLE' : 'SIGN_IN_REQUIRED' }, auth.status);
            let sessionId;
            if (request.method === 'GET') sessionId = url.searchParams.get('session_id');
            else {
                try { sessionId = (await request.json()).sessionId; }
                catch { return reject('Invalid request.', 400); }
            }
            if (typeof sessionId !== 'string' || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
                return reject('Invalid checkout session.', 400);
            }
            if (!env.STRIPE_SECRET_KEY || !env.PIXELPING_KV) {
                return reject('Payment verification unavailable.', 503);
            }
            try {
                const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                if (session.client_reference_id !== auth.userId)
                    return reject('Checkout is not verified for this account.');
                if (session.status === 'expired') return reject('This checkout expired without confirmation.', 409);
                if (session.status !== 'complete' || session.payment_status !== 'paid') return pending();
                const items = await stripe.checkout.sessions.listLineItems(sessionId);
                const product = productFor(items.data[0]?.price?.id, session.mode);
                if (!product) return reject('Unknown checkout product.');
                // The short-lived session alias supports immediate receipt display;
                // the durable checkout mapping keeps legitimate older receipts verifiable.
                let licenseKey = await env.PIXELPING_KV.get(`session:${sessionId}`, { cacheTtl: 30 });
                if (!licenseKey) {
                    const durable = await env.PIXELPING_KV.get(`checkout:${sessionId}`, { cacheTtl: 30 });
                    if (durable) licenseKey = JSON.parse(durable).licenseKey;
                }
                if (!licenseKey) return pending();
                const raw = await env.PIXELPING_KV.get(licenseKey, { cacheTtl: 30 });
                if (!raw) return pending();
                const license = raw ? JSON.parse(raw) : null;
                // Older legitimate licenses predate checkoutSessionId on the KV record.
                // Stripe ownership + the session-to-license mapping still verify them.
                if (license?.userId !== auth.userId || license?.tier !== product.tier ||
                    (license.checkoutSessionId && license.checkoutSessionId !== sessionId)) {
                    return reject('Checkout license mismatch.');
                }
                if (product.tier === 'evolution') {
                    if (!session.subscription) return reject('Subscription license requires reconciliation.');
                    if (!license.subscriptionId) return pending();
                    if (session.subscription !== license.subscriptionId)
                        return reject('Subscription license requires reconciliation.');
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    // An unpaid upcoming invoice does not erase the LAST paid period.
                    // Trust the server-held entitlement reconciled from verified paid invoices.
                    const accessRaw = await env.PIXELPING_KV.get(`account-access:${auth.userId}`, { cacheTtl: 30 });
                    const access = accessRaw ? JSON.parse(accessRaw) : null;
                    if (!access) return pending();
                    if (access.userId !== auth.userId) return reject('Subscription account evidence mismatch.');
                    if (access.subscriptionId !== session.subscription ||
                        !Number.isInteger(access.paidThrough) || access.paidThrough <= 0) return pending();
                    if (recoveryPhase(access.paidThrough) !== 'active') {
                        // A newly paid invoice can precede the account KV update.
                        // Stripe evidence permits waiting, never grants access here.
                        const observed = await confirmedSubscriptionPaidThrough(stripe, subscription);
                        if (recoveryPhase(observed) === 'active') return pending();
                        return reject('Evolution paid period has ended.');
                    }
                }
                return verifyResponse({ valid: true, licenseKey, token: licenseKey, mode: session.mode, tier: product.tier });
            } catch (err) {
                console.error('Checkout verification error:', err.message);
                if (err.code === 'resource_missing') return reject('Invalid checkout session.', 400);
                return verifyResponse({ valid: false, retryable: true, code: 'VERIFICATION_UNAVAILABLE',
                    error: 'Checkout verification temporarily unavailable.' }, 502);
            }
        }

        if (request.method === 'POST' && url.pathname === '/create-session') {
            const auth = await authenticatedUser(request, env);
            if (auth.error) return respond({ error: auth.error }, auth.status);
            if (!env.STRIPE_SECRET_KEY) return respond({ error: 'Stripe is not configured.' }, 503);
            let body;
            try { body = await request.json(); }
            catch { return respond({ error: 'Invalid checkout request.' }, 400); }
            const product = productFor(body.priceId, body.mode);
            if (!product || (body.userId && body.userId !== auth.userId)) {
                return respond({ error: 'Invalid product, mode, or account.' }, 400);
            }
            try {
                const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
                const session = await stripe.checkout.sessions.create({
                    ui_mode: 'embedded',
                    payment_method_types: ['card'],
                    line_items: [{ price: body.priceId, quantity: 1 }],
                    mode: product.mode,
                    allow_promotion_codes: true,
                    return_url: 'https://pixelping.app/?session_id={CHECKOUT_SESSION_ID}',
                    client_reference_id: auth.userId,
                    ...(product.tier === 'evolution' ? {
                        subscription_data: { metadata: { clerkUserId: auth.userId } }
                    } : {})
                });
                return respond({ clientSecret: session.client_secret });
            } catch (err) {
                console.error('Checkout creation failed:', err.message);
                return respond({ error: 'Unable to create checkout.' }, 502);
            }
        }

        // Only Stripe-signed webhook requests can provision an entitlement.
        if (request.method === 'POST' && ['/', '/webhook'].includes(url.pathname)) {
            if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET ||
                !env.CLERK_SECRET_KEY || !env.PIXELPING_KV) {
                return respond({ error: 'Payment provisioning is not configured.' }, 503);
            }
            let event;
            try {
                const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
                event = await stripe.webhooks.constructEventAsync(
                    await request.text(), request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                return respond({ error: 'Invalid Stripe webhook signature.' }, 400);
            }
            const lifecycleEvent = ['customer.subscription.created', 'customer.subscription.updated',
                'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed',
                'invoice.paid', 'invoice.payment_failed'].includes(event.type);
            const checkoutEvent = ['checkout.session.completed',
                'checkout.session.async_payment_succeeded'].includes(event.type);
            if (!lifecycleEvent && !checkoutEvent) return respond({ received: true });
            try {
                const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
                if (lifecycleEvent) {
                    const snapshot = event.data.object;
                    const subId = event.type.startsWith('customer.subscription.') ? snapshot.id :
                        (typeof snapshot.subscription === 'string' ? snapshot.subscription : snapshot.subscription?.id);
                    if (!subId) return respond({ received: true, ignored: 'No subscription on event.' });
                    // Stripe retrieval prevents stale deliveries from reactivating a canceled account.
                    const latest = await stripe.subscriptions.retrieve(subId);
                    const result = await reconcileEvolutionSubscription(env, latest, null, stripe,
                        event.type === 'invoice.paid' ? snapshot : null);
                    if (result.userId && !result.linkedElsewhere) {
                        await recordStripeAccountEvent(env, result.userId, event,
                            describeSubscriptionEvent(event, latest));
                    }
                    return respond({ received: true, ...result });
                }
                // Event snapshots use the webhook endpoint's API version.
                // Retrieve with our pinned API version before reading payment,
                // product or purchaser fields, including for legacy snapshots.
                const snapshot = event.data.object;
                if (typeof snapshot?.id !== 'string' || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(snapshot.id)) {
                    throw new Error('Invalid checkout session ID');
                }
                const session = await stripe.checkout.sessions.retrieve(snapshot.id);
                if (session.id !== snapshot.id) throw new Error('Checkout session ID mismatch');
                // Asynchronous payment methods can complete Checkout before funds are paid.
                if (session.status !== 'complete' || session.payment_status !== 'paid') {
                    return respond({ received: true, provisioned: false });
                }
                const userId = session.client_reference_id;
                if (typeof userId !== 'string' || !userId.startsWith('user_')) {
                    return respond({ error: 'Checkout has no authenticated account.' }, 503);
                }
                const items = await stripe.checkout.sessions.listLineItems(session.id);
                const product = productFor(items.data[0]?.price?.id, session.mode);
                if (!product) return respond({ error: 'Checkout product mismatch.' }, 503);

                // Read Stripe's current subscription even when an old checkout event is
                // delivered late. A canceled subscription must not be re-granted.
                let evolutionSubscription = null;
                if (product.tier === 'evolution') {
                    if (typeof session.subscription !== 'string') throw new Error('Missing subscription ID');
                    evolutionSubscription = await stripe.subscriptions.retrieve(session.subscription);
                    const recon = await reconcileEvolutionSubscription(env, evolutionSubscription, userId, stripe);
                    if (!recon.isActive || recon.linkedElsewhere) {
                        return respond({ received: true, provisioned: false,
                            reason: 'Subscription has no currently paid service interval.' });
                    }
                } else {
                    const current = await getClerkAccount(env, userId);
                    const previous = current.public_metadata || {};
                    const activeEvolution = previous.tier === 'evolution' &&
                        Number.isInteger(previous.evolutionPaidThrough) &&
                        previous.evolutionPaidThrough > Math.floor(Date.now() / 1000);
                    await updateClerkMetadata(env, userId, { ...previous,
                        masterKeyOwned: true, tier: activeEvolution ? 'evolution' : 'master-key'
                    });
                }

                // Keep a durable checkout mapping for repeat webhook deliveries. Its
                // session alias expires after 24h, but the durable mapping does not.
                const mapKey = `checkout:${session.id}`;
                const existing = await env.PIXELPING_KV.get(mapKey);
                let licenseKey;
                if (existing) {
                    const record = JSON.parse(existing);
                    if (record.userId !== userId || record.tier !== product.tier) {
                        throw new Error('Existing checkout mapping mismatch');
                    }
                    licenseKey = record.licenseKey;
                    if (!await env.PIXELPING_KV.get(licenseKey)) {
                        throw new Error('Persisted license record is missing');
                    }
                } else {
                    const bytes = crypto.getRandomValues(new Uint8Array(16));
                    licenseKey = 'PP-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
                    await env.PIXELPING_KV.put(licenseKey, JSON.stringify({
                        tier: product.tier, userId, checkoutSessionId: session.id,
                        subscriptionId: product.tier === 'evolution' ? session.subscription || null : null,
                        created_at: new Date().toISOString()
                    }));
                    await env.PIXELPING_KV.put(mapKey, JSON.stringify({ licenseKey, userId, tier: product.tier }));
                }
                await env.PIXELPING_KV.put(`session:${session.id}`, licenseKey, { expirationTtl: 86400 });
                await recordStripeAccountEvent(env, userId, event, {
                    title: product.tier === 'evolution' ? 'Evolution purchase activated' : 'Master Key purchased',
                    detail: product.tier === 'evolution' ?
                        'Evolution checkout completed and the account was provisioned.' :
                        'Your permanent Master Key purchase was provisioned.'
                });
                return respond({ received: true, provisioned: true });
            } catch (err) {
                // Stripe should retry transient Clerk/KV outages: never acknowledge success
                // while an entitlement or its license has not been fully persisted.
                console.error('Webhook provisioning failed:', err.message);
                return respond({ error: 'Payment provisioning temporarily unavailable.' }, 503);
            }
        }
        return respond({ error: 'Not found.' }, 404);
    },
    async scheduled(controller, env, ctx) {
        // Requires the Cron Trigger documented in webhook-worker/wrangler.jsonc.example.
        const task = controller?.cron === '*/15 * * * *' ? deliverNotices(env) : sweepRecovery(env);
        if (ctx?.waitUntil) ctx.waitUntil(task);
        else await task;
    }
};
