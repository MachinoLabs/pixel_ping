// Batch 08: transactional email outbox, provider callbacks, and retry scheduling.
// All outbound email is disabled until the Worker has RESEND_API_KEY and EMAIL_FROM_ADDRESS.
// The account event log remains the source of truth; the outbox is only its delivery projection.

const PREFIX = 'email-outbox:';
const MAX_ATTEMPTS = 8;
const MAX_PER_RUN = 40;

export async function queueNotice(kv, userId, eventKey, eventId) {
    const key = `${PREFIX}${userId}:${eventId}`;
    // Do not overwrite an accepted or delivered message when Stripe retries a webhook.
    if (await kv.get(key)) return key;
    await kv.put(key, JSON.stringify({ userId, eventId, eventKey,
        status: 'pending', attempts: 0, nextAttemptAt: 0,
        createdAt: new Date().toISOString(), providerEmailId: null }));
    return key;
}

async function* listAll(kv, prefix, maxPages = 100) {
    let cursor, pages = 0;
    do {
        const page = await kv.list({ prefix, ...(cursor ? { cursor } : {}) });
        for (const item of page.keys) yield item.name;
        cursor = page.list_complete === false ? page.cursor : null;
        if (++pages > maxPages) throw new Error(`Outbox listing limit exceeded for ${prefix}`);
    } while (cursor);
}

function safeEmail(account) {
    const emails = Array.isArray(account.email_addresses) ? account.email_addresses : [];
    const verified = emails.filter(e => e?.verification?.status === 'verified' &&
        typeof e.email_address === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email_address));
    const primary = verified.find(e => e.id === account.primary_email_address_id);
    return primary?.email_address || verified[0]?.email_address || null;
}

function retryDelaySeconds(attempts) {
    return Math.min(86400, 60 * (2 ** Math.min(attempts - 1, 10)));
}

// Repair a rare interrupted event->outbox write during the next sweep. Bounded by
// event-history pagination and cap. Events without notify:true are never emailed.
async function reconcileMissedNotices(kv) {
    let restored = 0;
    for await (const key of listAll(kv, 'account-event:')) {
        const raw = await kv.get(key);
        if (!raw) continue;
        const event = JSON.parse(raw);
        const userId = key.split(':')[1];
        if (!userId?.startsWith('user_') || !event?.notify || !event.id) continue;
        const outboxKey = `${PREFIX}${userId}:${event.id}`;
        if (!await kv.get(outboxKey)) { await queueNotice(kv, userId, key, String(event.id)); restored++; }
    }
    return restored;
}

export async function deliverNotices(env, now = Math.floor(Date.now() / 1000)) {
    if (!env.PIXELPING_KV) throw new Error('Outbox KV is not configured');
    const kv = env.PIXELPING_KV;
    const restored = await reconcileMissedNotices(kv);
    const activatedAt = Number(env.EMAIL_NOTIFICATIONS_START_AT);
    if (env.EMAIL_NOTIFICATIONS_ENABLED !== 'true' || !env.RESEND_API_KEY ||
        !env.EMAIL_FROM_ADDRESS || !Number.isInteger(activatedAt) || activatedAt <= 0) {
        return { configured: false, restored, accepted: 0, retried: 0, failed: 0 };
    }
    let attempted = 0, accepted = 0, retried = 0, failed = 0;
    for await (const key of listAll(kv, PREFIX)) {
        if (attempted >= MAX_PER_RUN) break;
        const raw = await kv.get(key);
        if (!raw) continue;
        const item = JSON.parse(raw);
        if (!item?.userId || !item.eventId || !item.eventKey ||
            !['pending', 'retry'].includes(item.status) || Number(item.nextAttemptAt || 0) > now) continue;
        attempted++;
        const eventRaw = await kv.get(item.eventKey);
        if (!eventRaw) {
            item.status = 'failed'; item.lastError = 'Associated account event is unavailable.';
            item.updatedAt = new Date(now * 1000).toISOString();
            await kv.put(key, JSON.stringify(item)); failed++; continue;
        }
        const event = JSON.parse(eventRaw);
        const eventWhen = Date.parse(event.at || '');
        // Do not bulk-email historical activity when a provider is activated.
        if (!Number.isFinite(eventWhen) || eventWhen < activatedAt * 1000) {
            item.status = 'skipped'; item.lastError = 'Pre-activation event';
            item.updatedAt = new Date(now * 1000).toISOString();
            await kv.put(key, JSON.stringify(item)); continue;
        }
        if (!event.notify) { item.status = 'skipped'; await kv.put(key, JSON.stringify(item)); continue; }
        try {
            const userResponse = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(item.userId)}`, {
                headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` }
            });
            if (!userResponse.ok) throw Object.assign(new Error('Clerk address lookup unavailable'), { retryable: userResponse.status >= 500 || userResponse.status === 429 });
            const account = await userResponse.json();
            if (account.id !== item.userId) throw Object.assign(new Error('Clerk identity mismatch'), { retryable: false });
            const recipient = safeEmail(account);
            if (!recipient) throw Object.assign(new Error('No verified customer email address'), { retryable: false });
            const payload = { from: env.EMAIL_FROM_ADDRESS, to: [recipient],
                subject: `PixelPing — ${String(event.title || 'Account notice').slice(0, 140)}`,
                text: `${String(event.title || 'Account notice')}\n\n${String(event.detail || '')}\n\nView your account: https://pixelping.app/admin.html\n\nThis is a PixelPing account notification.` };
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json', 'Idempotency-Key': `pixelping-${item.eventId}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                // Resend 409 can mean a concurrent idempotent request: safe to retry.
                const retryable = response.status === 429 || response.status >= 500 || response.status === 409;
                throw Object.assign(new Error(`Email provider rejected request (${response.status})`), { retryable });
            }
            const result = await response.json();
            if (typeof result.id !== 'string' || !result.id) throw new Error('Provider did not return a message ID');
            // Save the provider mapping BEFORE recording accepted status for callbacks.
            await kv.put(`email-provider:${result.id}`, JSON.stringify({ key, userId: item.userId, eventId: item.eventId }));
            item.status = 'accepted'; item.providerEmailId = result.id;
            item.acceptedAt = new Date(now * 1000).toISOString(); item.updatedAt = item.acceptedAt;
            item.attempts = Number(item.attempts || 0) + 1;
            delete item.lastError;
            await kv.put(key, JSON.stringify(item)); accepted++;
        } catch (error) {
            item.attempts = Number(item.attempts || 0) + 1;
            item.lastError = String(error?.message || 'Email delivery unavailable').slice(0, 160);
            item.updatedAt = new Date(now * 1000).toISOString();
            if (error?.retryable === false || item.attempts >= MAX_ATTEMPTS) {
                item.status = 'failed'; failed++;
            } else {
                item.status = 'retry';
                item.nextAttemptAt = now + retryDelaySeconds(item.attempts);
                retried++;
            }
            await kv.put(key, JSON.stringify(item));
        }
    }
    return { configured: true, restored, attempted, accepted, retried, failed };
}

// Resend uses the Svix signature format. Verify timestamp and HMAC over the
// ORIGINAL request body before trusting any message outcome.
export async function verifyResendWebhook(request, secret, raw, now = Math.floor(Date.now() / 1000)) {
    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signatures = request.headers.get('svix-signature');
    if (!secret?.startsWith('whsec_') || !id || !timestamp || !signatures ||
        !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return false;
    try {
        const decoded = atob(secret.slice(6));
        const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const signed = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
        for (const part of signatures.split(' ')) {
            const sig = part.startsWith('v1,') ? part.slice(3) : '';
            if (!sig) continue;
            const value = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
            if (await crypto.subtle.verify('HMAC', key, value, signed)) return true;
        }
        return false;
    } catch { return false; }
}

export async function recordDeliveryCallback(kv, event) {
    const emailId = event?.data?.email_id || event?.data?.id;
    const type = event?.type;
    const state = {
        'email.delivered': 'delivered', 'email.bounced': 'bounced',
        'email.failed': 'failed', 'email.complained': 'complained',
        'email.suppressed': 'suppressed', 'email.delivery_delayed': 'delayed',
        'email.sent': 'sent'
    }[type];
    if (!emailId || !state) return { ignored: true };
    const ref = await kv.get(`email-provider:${emailId}`);
    if (!ref) throw new Error('Email callback arrived before provider mapping was visible');
    const mapping = JSON.parse(ref);
    const raw = await kv.get(mapping.key);
    if (!raw) throw new Error('Outbox record unavailable');
    const item = JSON.parse(raw);
    if (item.userId !== mapping.userId || item.eventId !== mapping.eventId ||
        item.providerEmailId !== emailId) throw new Error('Email callback account mismatch');
    const terminal = ['delivered', 'bounced', 'failed', 'complained', 'suppressed'];
    if (terminal.includes(item.status)) return { success: true, unchanged: true };
    // Never downgrade an accepted/delivered outcome based on earlier 'sent' events.
    if (state === 'sent' && item.status !== 'accepted') return { success: true, unchanged: true };
    item.status = state;
    item.updatedAt = new Date().toISOString();
    item.lastProviderEvent = type;
    await kv.put(mapping.key, JSON.stringify(item));
    return { success: true, status: state };
}
