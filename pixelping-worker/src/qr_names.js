// Account-owned friendly labels only. Never mutates a route or encoded content.
const validName = name => typeof name === 'string' && name.trim().length > 0 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name);
export function nameKey(state, fallback) {
    if (state?.mode === 'dynamic' && /^[A-Za-z0-9_-]{3,64}$/.test(state.route?.slug || '')) return 'route:' + state.route.slug;
    return typeof state?.assetId === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(state.assetId) ? 'asset:' + state.assetId : fallback ? 'asset:' + fallback : null;
}
export function qrNames(storage, owner) {
    storage.sql.exec('CREATE TABLE IF NOT EXISTS qr_names (owner TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(owner,key))');
    const existing=new Set([...storage.sql.exec('SELECT key FROM qr_names WHERE owner=?',owner)].map(x=>x.key));
    const hasCodes=[...storage.sql.exec("SELECT name FROM sqlite_master WHERE name='saved_codes'")].length;
    if(hasCodes)for(const row of storage.sql.exec('SELECT id,name,data FROM saved_codes WHERE owner=? ORDER BY updatedAt DESC,id',owner)){
        const key=nameKey(JSON.parse(row.data),row.id);
        if(key&&!existing.has(key)){storage.sql.exec('INSERT OR IGNORE INTO qr_names (owner,key,name,revision) VALUES (?,?,?,1)',owner,key,row.name);existing.add(key);}
    }
    return [...storage.sql.exec('SELECT key,name,revision FROM qr_names WHERE owner=?', owner)];
}
export function setQrName(storage, owner, key, name) {
    qrNames(storage, owner);
    const prior = [...storage.sql.exec('SELECT name,revision FROM qr_names WHERE owner=? AND key=?', owner,key)][0];
    if (prior?.name !== name) storage.sql.exec('INSERT INTO qr_names (owner,key,name,revision) VALUES (?,?,?,1) ON CONFLICT(owner,key) DO UPDATE SET name=excluded.name, revision=qr_names.revision+1', owner,key,name);
    // Same account/SQLite transaction: linked designs and recents cannot diverge.
    const tables = new Set([...storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table'")].map(x=>x.name));
    if (tables.has('saved_codes')) for (const row of storage.sql.exec('SELECT * FROM saved_codes WHERE owner=?',owner)) {
        const state = JSON.parse(row.data);
        if (nameKey(state,row.id) === key && row.name !== name) storage.sql.exec('UPDATE saved_codes SET name=?,revision=revision+1,updatedAt=? WHERE id=? AND owner=?',name,new Date().toISOString(),row.id,owner);
    }
    const row = [...storage.sql.exec('SELECT owner,data FROM workspace WHERE id=1')][0];
    if (row?.owner === owner) {
        const data = JSON.parse(row.data); let changed = false;
        for (const item of data.history || []) if (nameKey(item.state) === key && item.state.friendlyName !== name) {item.state.friendlyName=name;changed=true;}
        if(changed){data.revision++;storage.sql.exec('UPDATE workspace SET data=? WHERE id=1',JSON.stringify(data));}
    }
}
export function namesRequest(storage, body) {
    const owner=body.userId, op=body.operation;
    return storage.transactionSync(()=>{
        const row=[...storage.sql.exec('SELECT owner FROM workspace WHERE id=1')][0];
        if(row && row.owner!==owner)return Response.json({error:'Account mismatch.'},{status:403});
        const names=qrNames(storage,owner);
        const namesOwner=[...storage.sql.exec('SELECT owner FROM qr_names LIMIT 1')][0];
        const hasCodes=[...storage.sql.exec("SELECT name FROM sqlite_master WHERE name='saved_code_operations'")].length;
        const codeOwner=hasCodes&&[...storage.sql.exec('SELECT owner FROM saved_code_operations LIMIT 1')][0];
        if(namesOwner&&namesOwner.owner!==owner||codeOwner&&codeOwner.owner!==owner)return Response.json({error:'Account mismatch.'},{status:403});
        if(op){
            if(!/^(route:[A-Za-z0-9_-]{3,64}|asset:[A-Za-z0-9_-]{16,80})$/.test(op.key||'') || !validName(op.name) || !Number.isSafeInteger(op.expectedRevision)||op.expectedRevision<0)
                return Response.json({error:'Enter a name of 1–80 characters without line breaks.'},{status:400});
            const previous=names.find(x=>x.key===op.key);
            if((previous?.revision||0)!==op.expectedRevision)return Response.json({error:'This QR name changed on another screen. Refresh and try again.'},{status:409});
            // Static asset ownership is established from retained account records.
            if(op.key.startsWith('asset:')){
                const w=[...storage.sql.exec('SELECT data FROM workspace WHERE id=1')][0];
                let owned=w&&JSON.parse(w.data).history.some(x=>nameKey(x.state)===op.key);
                if(!owned){const exists=[...storage.sql.exec("SELECT name FROM sqlite_master WHERE name='saved_codes'")].length;owned=exists&&[...storage.sql.exec('SELECT id,data FROM saved_codes WHERE owner=?',owner)].some(x=>nameKey(JSON.parse(x.data),x.id)===op.key);}
                if(!owned)return Response.json({error:'Save this design before syncing its name.'},{status:404});
            }
            setQrName(storage,owner,op.key,op.name.trim());
        }
        return Response.json({success:true,names:qrNames(storage,owner)});
    });
}
