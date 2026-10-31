// Batch 20: One global SQLite Durable Object serializes customer hostname
// ownership AND the one-domain-per-account rule. KV remains a legacy mirror.
// Only the routing Worker can call this object; no public HTTP endpoint.
import { DurableObject } from 'cloudflare:workers';

const respond = (data, status = 200) => Response.json(data, { status });
const ownerOK = value => typeof value === 'string' && /^user_[A-Za-z0-9_-]+$/.test(value);
const hostOK = value => typeof value === 'string' && value.length <= 253 &&
    /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value) && value.includes('.');

export class DomainRegistry extends DurableObject {
    async fetch(request) {
        if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
        let data;
        try { data = await request.json(); } catch { return respond({ error: 'Malformed request' }, 400); }
        const { action, userId, hostname, record } = data || {};
        if (!['reserve', 'commit', 'status', 'by-user', 'by-host'].includes(action) ||
            (action !== 'by-host' && !ownerOK(userId)) ||
            (['reserve', 'commit', 'by-host'].includes(action) && !hostOK(hostname)) ||
            (action === 'status' && !hostOK(record?.hostname)))
            return respond({ error: 'Invalid request' }, 400);
        try {
            return await this.ctx.blockConcurrencyWhile(async () => {
                const store = this.ctx.storage;
                const userKey = id => `account:${id}`;
                const hostKey = name => `host:${name}`;
                const itemKey = id => `record:${id}`;

                // Import a pre-Batch-20 domain only when BOTH original KV
                // indexes agree. Inconsistent legacy data is not trusted.
                const hydrate = async (id, host) => {
                    const [saved, index] = await Promise.all([
                        this.env.PIXELPING_KV.get(`custom-domain-user:${id}`),
                        this.env.PIXELPING_KV.get(`custom-domain-host:${host}`)
                    ]);
                    if (!saved || index !== id) return false;
                    let old;
                    try { old = JSON.parse(saved); } catch { return false; }
                    if (old?.userId !== id || old?.hostname !== host || !old.cfId) return false;
                    const [usedUser, usedHost] = await Promise.all([store.get(userKey(id)), store.get(hostKey(host))]);
                    if ((usedUser && usedUser !== host) || (usedHost && usedHost !== id))
                        return false;
                    await store.put({ [userKey(id)]: host, [hostKey(host)]: id, [itemKey(id)]: old });
                    return true;
                };
                if (action === 'reserve') {
                    // A single DO serializes competing hostnames and users.
                    const [ownedHost, hostOwner, oldOwnerIndex, oldUserRaw] = await Promise.all([
                        store.get(userKey(userId)), store.get(hostKey(hostname)),
                        this.env.PIXELPING_KV.get(`custom-domain-host:${hostname}`),
                        this.env.PIXELPING_KV.get(`custom-domain-user:${userId}`)
                    ]);
                    if (ownedHost || hostOwner || oldOwnerIndex || oldUserRaw)
                        return respond({ error: 'Hostname or account already reserved' }, 409);
                    await store.put({ [userKey(userId)]: hostname, [hostKey(hostname)]: userId });
                    // Even if external provisioning fails, the claim is kept.
                    // Support must reconcile uncertain provider outcomes rather
                    // than inadvertently freeing a possibly active hostname.
                    return respond({ success: true, state: 'provisioning' }, 201);
                }
                if (action === 'commit') {
                    if (!record || record.hostname !== hostname || record.userId !== userId ||
                        typeof record.cfId !== 'string' || !record.cfId)
                        return respond({ error: 'Invalid provider record' }, 400);
                    if (await store.get(userKey(userId)) !== hostname ||
                        await store.get(hostKey(hostname)) !== userId)
                        return respond({ error: 'Ownership mismatch' }, 409);
                    const existing = await store.get(itemKey(userId));
                    if (existing) return respond({ error: 'Domain already registered' }, 409);
                    await store.put(itemKey(userId), record);
                    return respond({ success: true });
                }
                if (action === 'status') {
                    const current = await store.get(itemKey(userId));
                    if (!current || current.hostname !== record.hostname ||
                        current.cfId !== record.cfId || await store.get(hostKey(current.hostname)) !== userId)
                        return respond({ error: 'Ownership mismatch' }, 409);
                    // Only verification-derived fields are mutable here.
                    const verified = record.status === 'active' && record.hostnameStatus === 'active' &&
                        record.sslStatus === 'active' && record.dnsReady === true;
                    const next = { ...current, status: verified ? 'active' : 'pending',
                        hostnameStatus: String(record.hostnameStatus || 'pending'),
                        sslStatus: String(record.sslStatus || 'pending'),
                        dnsReady: record.dnsReady === true,
                        records: Array.isArray(record.records) ? record.records : current.records };
                    await store.put(itemKey(userId), next);
                    return respond({ success: true, record: next });
                }
                if (action === 'by-user') {
                    let current = await store.get(itemKey(userId));
                    if (!current) {
                        const raw = await this.env.PIXELPING_KV.get(`custom-domain-user:${userId}`);
                        if (raw) {
                            let parsed = null;
                            try { parsed = JSON.parse(raw); } catch { /* fail closed */ }
                            if (parsed && hostOK(parsed.hostname) && await hydrate(userId, parsed.hostname))
                                current = await store.get(itemKey(userId));
                        }
                    }
                    return respond({ record: current || null });
                }
                if (action === 'by-host') {
                    let owner = await store.get(hostKey(hostname));
                    if (!owner) {
                        const legacyOwner = await this.env.PIXELPING_KV.get(`custom-domain-host:${hostname}`);
                        if (legacyOwner && ownerOK(legacyOwner) && await hydrate(legacyOwner, hostname))
                            owner = legacyOwner;
                    }
                    const current = owner ? await store.get(itemKey(owner)) : null;
                    return respond({ record: current?.hostname === hostname && current.userId === owner ? current : null });
                }
                return respond({ error: 'Unsupported action' }, 400);
            });
        } catch (error) {
            console.error('Domain reservation failure:', error.message);
            return respond({ error: 'Domain ownership service temporarily unavailable' }, 503);
        }
    }
}
