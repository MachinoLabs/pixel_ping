import { namesRequest, qrNames, nameKey, setQrName } from './qr_names.js';
import { termsRequest } from './terms_acceptance.js';
import { savedCodesRequest } from './saved_codes.js';
// Account-owned Recent Codes and brand kit. One SQLite object per Clerk user.
const ID = /^[A-Za-z0-9_-]{16,80}$/;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeKeys = value => Object.keys(value).every(key =>
    !['__proto__', 'constructor', 'prototype'].includes(key));
function validBrand(value) {
    if (value === null) return true;
    if (!object(value) || !safeKeys(value)) return false;
    const names = ['cornersType', 'colorDots', 'colorCorners', 'colorBg', 'mask', 'icon', 'customLogo'];
    if (Object.keys(value).some(key => !names.includes(key))) return false;
    for (const key of names.filter(key => key !== 'customLogo')) {
        if (typeof value[key] !== 'string' || value[key].length > 80) return false;
    }
    if (['colorDots', 'colorCorners', 'colorBg'].some(key => !/^#[a-f\d]{6}$/i.test(value[key]))) return false;
    return value.customLogo == null || (typeof value.customLogo === 'string' &&
        value.customLogo.length <= 85000 && /^data:image\/png;base64,[A-Za-z\d+/=]+$/.test(value.customLogo));
}
function validState(value) {
    if (!object(value) || !safeKeys(value) || JSON.stringify(value).length > 98304) return false;
    if (Object.keys(value).some(key => !['type', 'label', 'date', 'inputs', 'styles', 'mode', 'route', 'print', 'assetId', 'friendlyName'].includes(key))) return false;
    if (typeof value.type !== 'string' || value.type.length > 32 ||
        typeof value.label !== 'string' || value.label.length > 1024 ||
        typeof value.date !== 'string' || value.date.length > 128 ||
        !object(value.inputs) || !safeKeys(value.inputs) || Object.keys(value.inputs).length > 100) return false;
    if (Object.entries(value.inputs).some(([key, item]) => !/^[A-Za-z][A-Za-z\d_-]{0,79}$/.test(key) ||
        typeof item !== 'string' || item.length > 16384)) return false;
    if (value.mode !== undefined && !['static','dynamic'].includes(value.mode)) return false;
    if (value.assetId !== undefined && !ID.test(value.assetId)) return false;
    if (value.friendlyName !== undefined && (typeof value.friendlyName!=='string'||value.friendlyName.length>80||/[\u0000-\u001f\u007f]/.test(value.friendlyName))) return false;
    if (value.route !== undefined && value.route !== null) {
        const route=value.route;
        if (!object(route) || Object.keys(route).some(key=>!['slug','kind','activated'].includes(key)) ||
            !ID.test(route.slug||'') || !['link','phone','sms','email','coupon'].includes(route.kind) ||
            typeof route.activated !== 'boolean' || value.mode !== 'dynamic') return false;
    }
    if (value.mode === 'dynamic' && !value.route) return false;
    if (value.mode === 'static' && value.route != null) return false;
    if (value.print !== undefined && (!object(value.print) ||
        Object.keys(value.print).some(key=>!['layout','size','format','includeName'].includes(key)) ||
        !['label','poster'].includes(value.print.layout) || !['2in','3.5in','5in','8in'].includes(value.print.size) ||
        !['png','svg','pdf'].includes(value.print.format) ||
        (value.print.includeName!==undefined&&typeof value.print.includeName!=='boolean'))) return false;
    return object(value.styles) && validBrand(value.styles);
}
export class AccountWorkspace {
    constructor(ctx) {
        this.storage = ctx.storage;
        this.sql = ctx.storage.sql;
        this.sql.exec('CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, data TEXT NOT NULL)');
        this.sql.exec('CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY)');
    }
    async fetch(request) {
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        let body;
        try {
            const raw = await request.text();
            if (new TextEncoder().encode(raw).length > 131072) return json({ error: 'Saved code is too large to sync.' }, 413);
            body = JSON.parse(raw);
        } catch { return json({ error: 'Invalid workspace request.' }, 400); }
        if (!/^user_[A-Za-z\d]+$/.test(body?.userId || '')) return json({ error: 'Invalid owner.' }, 400);
        if (new URL(request.url).pathname === '/terms') return termsRequest(this.storage,body);
        if (new URL(request.url).pathname === '/names') return namesRequest(this.storage,body);
        if (new URL(request.url).pathname === '/codes') return savedCodesRequest(this.storage,body,validState);
        const op = body.operation;
        if (op && (!ID.test(op.id || '') ||
            !['history.add', 'history.clear', 'brand.set'].includes(op.type) ||
            (op.type === 'history.add' && !validState(op.state)) ||
            (op.type === 'history.clear' && (!Array.isArray(op.ids) || op.ids.length > 5 || op.ids.some(id => !ID.test(id)))) ||
            (op.type === 'brand.set' && (!validBrand(op.brandKit) || !Number.isInteger(op.expectedBrandRevision) || op.expectedBrandRevision < 0)))) {
            return json({ error: 'Invalid saved code or brand settings.' }, 400);
        }
        return this.storage.transactionSync(() => {
            const row = [...this.sql.exec('SELECT owner, data FROM workspace WHERE id=1')][0];
            if (row && row.owner !== body.userId) return json({ error: 'Account mismatch.' }, 403);
            const state = row ? JSON.parse(row.data) : { revision: 0, brandRevision: 0, history: [], brandKit: null };
            if (op && ![...this.sql.exec('SELECT id FROM operations WHERE id=?', op.id)].length) {
                if (op.type === 'brand.set' && op.expectedBrandRevision !== state.brandRevision) {
                    return json({ success: false, conflict: true, workspace: state }, 409);
                }
                state.revision++;
                if (op.type === 'history.add') {
                    const key=nameKey(op.state), known=qrNames(this.storage,body.userId).find(x=>x.key===key);
                    if(key && !known && op.state.friendlyName?.trim()) setQrName(this.storage,body.userId,key,op.state.friendlyName.trim());
                    const current=qrNames(this.storage,body.userId).find(x=>x.key===key);
                    state.history.unshift({ id: op.id, state: {...op.state,...(current?{friendlyName:current.name}:{})} });
                    state.history = state.history.slice(0, 5);
                } else if (op.type === 'history.clear') {
                    state.history = state.history.filter(item => !op.ids.includes(item.id));
                } else {
                    state.brandKit = op.brandKit;
                    state.brandRevision++;
                }
                this.sql.exec('INSERT INTO operations (id) VALUES (?)', op.id);
            }
            const labels=qrNames(this.storage,body.userId);
            for(const item of state.history){if(!item.state.assetId)item.state.assetId=item.id;const n=labels.find(x=>x.key===nameKey(item.state));if(n)item.state.friendlyName=n.name;}
            this.sql.exec('INSERT INTO workspace (id, owner, data) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
                body.userId, JSON.stringify(state));
            return json({ success: true, workspace: state });
        });
    }
}
