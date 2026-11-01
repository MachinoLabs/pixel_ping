/* Private icon client: public IDs, protected raster previews, selected SVGs only.
 * The complete vector pack is never loaded or stored by the website.
 */
(() => {
    const hashes = window.pixelPingIconCatalog || {};
    const names = Object.keys(hashes);
    const prefix = 'pack-v1-';
    const api = 'https://pixelping-worker.amateuraiguy.workers.dev/api/icons/v1/';
    const memory = new Map(), pending = new Map(), failed = new Set();
    const user = () => window.Clerk?.user?.id ||
        (window.pixelPingOfflineMasterKeyValidated ? window.pixelPingOfflineMasterKeyOwnerId : null);
    let activeOwner = null, previewUrl = null, previewRun = 0;
    const status = message => {
        const el = document.getElementById('premium-icon-status');
        if (el) el.textContent = message;
    };
    const rawName = id => typeof id === 'string' && id.startsWith(prefix) ? id.slice(prefix.length) : '';
    const managed = id => Object.hasOwn(hashes, rawName(id));
    const title = id => ({ ticket: 'Coupon / Ticket', 'file-text': 'Text / Document' })[rawName(id)] || rawName(id).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const releasePreview = () => { previewRun++; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; };
    function identity() {
        const owner = user();
        if (owner !== activeOwner) {
            activeOwner = owner; memory.clear(); pending.clear(); failed.clear(); releasePreview();
        }
        return owner;
    }
    const sessionKey = () => window.Clerk?.session?.id || window.Clerk?.session;
    const entitled = () => window.pixelPingHasMasterKey?.() === true;
    async function verified(name, svg) {
        if (typeof svg !== 'string' || svg.length > 32768 || !svg.startsWith('<svg')) return false;
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(svg))),
            b => b.toString(16).padStart(2, '0')).join('');
        return digest === hashes[name];
    }
    async function request(file, owner, session) {
        const controller = new AbortController();
        let timer;
        try {
            return await Promise.race([
                (async () => {
                    const token = await window.Clerk?.session?.getToken();
                    if (!token || user() !== owner || sessionKey() !== session || controller.signal.aborted)
                        throw new Error('Sign in with your paid account to load this icon.');
                    const response = await fetch(api + file, {
                        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal
                    });
                    if (!response.ok) throw new Error(response.status === 429
                        ? 'Please wait a minute before loading more icons.'
                        : [401,403].includes(response.status) ? 'Sign in with your paid account to load this icon.'
                        : 'Icons are temporarily unavailable. Please try again.');
                    const bytes = await response.arrayBuffer();
                    if (user() !== owner || sessionKey() !== session || !entitled()) throw new Error('Account changed.');
                    return bytes;
                })(),
                new Promise((_, reject) => { timer = setTimeout(() => {
                    controller.abort(); reject(new Error('Icon request timed out. Please try again.'));
                }, 10000); })
            ]);
        } finally { clearTimeout(timer); }
    }
    function remember(owner, name, svg) {
        // Only five individually chosen icons, scoped to this account, for return/offline use.
        try {
            const key = 'pixelping-selected-icons-v1:' + owner;
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify([{ name, svg },
                ...(Array.isArray(list) ? list.filter(x => x.name !== name) : [])].slice(0, 5)));
        } catch (_) { /* Export remains available if browser storage is full. */ }
    }
    async function ensure(id) {
        if (!managed(id)) return null;
        const owner = identity(), session = sessionKey(), name = rawName(id);
        if (!owner || !entitled()) throw new Error('Sign in with your paid account to load this icon.');
        if (memory.has(id)) return memory.get(id);
        if (pending.has(id)) return pending.get(id);
        const run = (async () => {
            let svg;
            try {
                const saved = JSON.parse(localStorage.getItem('pixelping-selected-icons-v1:' + owner) || '[]');
                const item = Array.isArray(saved) && saved.find(x => x.name === name);
                if (item && await verified(name, item.svg)) svg = item.svg;
            } catch (_) {}
            if (!svg) {
                const bytes = await request(name + '.svg', owner, session);
                svg = new TextDecoder().decode(bytes);
                if (!await verified(name, svg)) throw new Error('Icon could not be verified. Please try again.');
            }
            if (user() !== owner || sessionKey() !== session || !entitled()) throw new Error('Account changed.');
            identity(); memory.set(id, svg);
            while (memory.size > 8) memory.delete(memory.keys().next().value);
            remember(owner, name, svg); failed.delete(id); status('');
            return svg;
        })();
        pending.set(id, run);
        try { return await run; }
        finally { if (pending.get(id) === run) pending.delete(id); }
    }
    const selected = () => document.getElementById('qr-icon')?.value;
    async function loadSelected(id) {
        if (failed.has(id)) return;
        status('Loading selected icon…');
        try {
            await ensure(id);
            if (selected() === id) window.updateQR?.();
        } catch (error) { if (selected() === id) { failed.add(id); status(error.message); } }
    }
    window.pixelPingIconLibrary = {
        names: names.map(n => prefix + n), managed, title, ensure, loadSelected, releasePreview,
        cached(id) { identity(); return entitled() ? memory.get(id) : null; },
        async ready(id) {
            if (!managed(id)) return;
            await ensure(id);
            if (selected() !== id) throw new Error('Icon selection changed. Please export again.');
            window.updateQR?.();
        },
        async preview() {
            const owner = identity(), session = sessionKey();
            if (!owner || !entitled()) throw new Error('Sign in with your paid account to view these icons.');
            if (previewUrl) return previewUrl;
            const run = ++previewRun;
            const bytes = await request('preview.png', owner, session);
            if (run !== previewRun) throw new Error('Icon picker closed.');
            previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
            return previewUrl;
        },
        index(id) { return names.indexOf(rawName(id)); }
    };
    // Register IDs before brand/history restoration assigns a select value.
    const select = document.getElementById('qr-icon');
    if (select) for (const name of names) {
        const option = document.createElement('option'); option.value = prefix + name;
        option.textContent = title(option.value); select.appendChild(option);
    }
    for (const event of ['pixelping:auth-ready','pixelping:entitlement-ready','pixelping:license-ready','online'])
        window.addEventListener(event, () => {
            identity(); failed.clear();
            if (managed(selected()) && entitled()) loadSelected(selected());
        });
    window.addEventListener('pagehide', releasePreview);
})();
