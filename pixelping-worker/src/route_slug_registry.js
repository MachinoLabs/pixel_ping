// Batch 19: one authoritative per-slug Durable Object for ownership, destination
// mutations, and scan totals. KV is retained for legacy migration and listing.
// The Worker is the only caller; this object is not exposed as an HTTP endpoint.
import { DurableObject } from 'cloudflare:workers';
import { validateSmartAction } from './smart_actions.js';

const validSlug = value => typeof value === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(value);
const validOwner = value => typeof value === 'string' && value.startsWith('user_');
const respond = (data, status = 200) => Response.json(data, { status });

export class RouteSlugRegistry extends DurableObject {
    async fetch(request) {
        if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
        let body;
        try { body = await request.json(); }
        catch { return respond({ error: 'Invalid request' }, 400); }
        const { action, slug, userId } = body || {};
        if (!validSlug(slug) || !['reserve', 'publish', 'publish-action', 'read', 'scan', 'update', 'update-action', 'tombstone'].includes(action) ||
            (['reserve', 'publish', 'publish-action', 'update', 'update-action', 'tombstone'].includes(action) && !validOwner(userId))) {
            return respond({ error: 'Invalid request' }, 400);
        }
        try {
            // Serializes external legacy reads, edits, scans, deletion and the
            // durable state changes. No KV scan read-modify-write is performed.
            return await this.ctx.blockConcurrencyWhile(async () => {
                let claim = await this.ctx.storage.get('claim');
                let route = await this.ctx.storage.get('route');
                let scans = await this.ctx.storage.get('scans');

                if (action === 'reserve') {
                    if (claim) return respond({ error: 'Slug already reserved' }, 409);
                    const [existing, deleted] = await Promise.all([
                        this.env.PIXELPING_KV.get(`link:${slug}`),
                        this.env.PIXELPING_KV.get(`route-reserved:${slug}`)
                    ]);
                    if (existing || deleted) {
                        let owner = null;
                        try { owner = existing ? JSON.parse(existing).userId : JSON.parse(deleted).originalUserId; }
                        catch { /* corrupt legacy data is always reserved */ }
                        await this.ctx.storage.put('claim', { slug, kind: 'legacy', userId: owner || null });
                        return respond({ error: 'Slug already reserved' }, 409);
                    }
                    // New claims cannot be hydrated from KV until explicitly
                    // published; this prevents exposing a half-created route.
                    await this.ctx.storage.put('claim', {
                        slug, kind: 'active', schema: 2, userId, reservedAt: new Date().toISOString()
                    });
                    return respond({ success: true });
                }

                // Lazy migration for pre-Batch-19 records. Batch 18 active
                // claims had no schema flag, unlike newly reserved claims.
                if (!route && (!claim || claim.schema !== 2) && claim?.kind !== 'tombstone') {
                    const deleted = await this.env.PIXELPING_KV.get(`route-reserved:${slug}`);
                    if (deleted) {
                        if (!claim) {
                            await this.ctx.storage.put('claim', { slug, kind: 'legacy', userId: null });
                        }
                        return respond({ error: 'Route unavailable' }, 404);
                    }
                    const raw = await this.env.PIXELPING_KV.get(`link:${slug}`);
                    if (raw) {
                        let legacy;
                        try { legacy = JSON.parse(raw); } catch { return respond({ error: 'Corrupt legacy route' }, 503); }
                        if (!validOwner(legacy.userId) || (claim?.userId && claim.userId !== legacy.userId)) {
                            return respond({ error: 'Route ownership mismatch' }, 403);
                        }
                        if (typeof legacy.destination !== 'string' || !/^https?:\/\//.test(legacy.destination)) {
                            return respond({ error: 'Corrupt legacy destination' }, 503);
                        }
                        route = {
                            slug, userId: legacy.userId, destination: legacy.destination,
                            title: legacy.title || slug, type: legacy.type || 'LINK',
                            createdAt: legacy.createdAt || new Date().toISOString()
                        };
                        scans = Number.isSafeInteger(legacy.clicks) && legacy.clicks >= 0 ? legacy.clicks : 0;
                        claim = { slug, kind: 'active', schema: 2, userId: legacy.userId,
                            reservedAt: claim?.reservedAt || route.createdAt };
                        await this.ctx.storage.put('claim', claim);
                        await this.ctx.storage.put('route', route);
                        await this.ctx.storage.put('scans', scans);
                    }
                }

                if (action === 'publish-action') {
                    if (claim?.kind !== 'active' || claim.userId !== userId || route) {
                        return respond({ error: 'Reservation not available for publication' }, 409);
                    }
                    const content = validateSmartAction(body.content);
                    if (!content) return respond({ error: 'Invalid action' }, 400);
                    route = { slug, userId, schema: 3, mode: 'action', ...content,
                        createdAt: typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString() };
                    await this.ctx.storage.put('route', route);
                    await this.ctx.storage.put('scans', 0);
                    return respond({ success: true });
                }

                if (action === 'publish') {
                    if (claim?.kind !== 'active' || claim.userId !== userId || route) {
                        return respond({ error: 'Reservation not available for publication' }, 409);
                    }
                    const candidate = body.route;
                    if (!candidate || candidate.userId !== userId || candidate.slug !== slug ||
                        typeof candidate.destination !== 'string' || !/^https?:\/\//.test(candidate.destination)) {
                        return respond({ error: 'Invalid route' }, 400);
                    }
                    route = { slug, userId, destination: candidate.destination,
                        title: candidate.title || slug, type: candidate.type || 'LINK',
                        createdAt: candidate.createdAt || new Date().toISOString() };
                    await this.ctx.storage.put('route', route);
                    await this.ctx.storage.put('scans', 0);
                    return respond({ success: true });
                }

                if (action === 'tombstone') {
                    if (claim?.kind === 'tombstone') return respond({ error: 'Route already deleted' }, 404);
                    if (!route || route.userId !== userId) return respond({ error: 'Route ownership mismatch' }, 403);
                    // Tombstone BEFORE attempting eventual KV cleanup. Even
                    // if KV fails, redirects are blocked and the slug never reused.
                    await this.ctx.storage.put('claim', { slug, kind: 'tombstone', schema: 2,
                        userId, reservedAt: claim?.reservedAt || route.createdAt,
                        deletedAt: new Date().toISOString() });
                    await this.ctx.storage.delete('route');
                    await this.env.PIXELPING_KV.put(`route-reserved:${slug}`, JSON.stringify({
                        slug, originalUserId: userId, reservedAt: new Date().toISOString()
                    }));
                    await this.env.PIXELPING_KV.delete(`link:${slug}`);
                    return respond({ success: true });
                }

                if (!route || claim?.kind !== 'active') return respond({ error: 'Route not found' }, 404);
                if (route.mode && !['web', 'action'].includes(route.mode)) return respond({ error: 'Invalid route mode' }, 503);
                if (route.mode === 'action' && (route.schema !== 3 || !validateSmartAction({
                    kind: route.kind, action: route.action, brand: route.brand, title: route.title
                }))) return respond({ error: 'Invalid stored action' }, 503);
                if (action === 'update-action') {
                    if (route.userId !== userId) return respond({ error: 'Route ownership mismatch' }, 403);
                    if (route.mode !== 'action') return respond({ error: 'Not an action route' }, 400);
                    const content = validateSmartAction(body.content);
                    if (!content) return respond({ error: 'Invalid action' }, 400);
                    route = { ...route, ...content };
                    await this.ctx.storage.put('route', route);
                    await this.env.PIXELPING_KV.put(`link:${slug}`, JSON.stringify(route));
                    return respond({ success: true });
                }
                if (action === 'update') {
                    if (route.userId !== userId) return respond({ error: 'Route ownership mismatch' }, 403);
                    if (route.mode === 'action') return respond({ error: 'Use the typed action editor' }, 400);
                    if (typeof body.destination !== 'string' || !/^https?:\/\//.test(body.destination)) {
                        return respond({ error: 'Invalid destination' }, 400);
                    }
                    const revision = Number.isSafeInteger(route.revision) ? route.revision : 0;
                    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)
                        return respond({ error: 'Reload the current destination before saving.' }, 400);
                    if (body.expectedRevision !== revision)
                        return respond({ error: 'The destination changed in another screen or device. Your older edit was not saved. Reload the destination and try again.' }, 409);
                    if (revision === Number.MAX_SAFE_INTEGER) return respond({ error: 'Route revision unavailable' }, 503);
                    // Route authority changes here. The KV mirror can lag but
                    // can never restore a deleted route or alter a redirect.
                    route = { ...route, destination: body.destination, revision: revision + 1 };
                    await this.ctx.storage.put('route', route);
                    await this.env.PIXELPING_KV.put(`link:${slug}`, JSON.stringify(route));
                    return respond({ success: true, revision: route.revision });
                }
                if (action === 'scan') {
                    if (!Number.isSafeInteger(scans) || scans < 0 || scans === Number.MAX_SAFE_INTEGER)
                        return respond({ error: 'Scan counter unavailable' }, 503);
                    scans++;
                    await this.ctx.storage.put('scans', scans);
                }
                return respond({ success: true, route, scans: scans ?? 0 });
            });
        } catch (error) {
            console.error('Durable route operation failed:', error.message);
            return respond({ error: 'Route service unavailable' }, 503);
        }
    }
}
