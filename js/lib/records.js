/**
 * records.js — the journal: every time-stamped thing the Study Pack records.
 *
 * The workspace (tasks, blocks, notes, settings) is a small working set and
 * still travels as one JSON document. History does not belong there: focus
 * sessions, check-ins and mood logs only ever grow, and a Firestore document
 * stops at 1 MiB. So they live in a real database instead — one row per
 * record, indexed by kind and time:
 *
 *   signed in   → Firestore, users/{uid}/journal/{id}, one document per record
 *   signed out  → IndexedDB, store "journal", index on [kind, at]
 *   no storage  → memory (private windows with IndexedDB switched off, tests)
 *
 * A record is `{ id, kind, at, ...fields }` where `at` is milliseconds. Nothing
 * here knows what a session or a mood contains; the app owns those shapes.
 *
 * Records are append-mostly and each one is written on its own, so two devices
 * editing at once merge instead of overwriting each other — which the single
 * workspace document cannot do. Signing in carries whatever was logged locally
 * up to the account (`merge`), so a trial run offline is never lost.
 */

export const KINDS = ['session', 'checkin', 'mood'];

const DB_NAME = 'adhd-study-pack';
const DB_VERSION = 1;
const STORE = 'journal';

/* ---------------------------------------------------------------------------
   IndexedDB. Wrapped in promises, and every failure resolves to a safe empty
   value rather than throwing: losing the history view is bad, but a private
   window that forbids IndexedDB must not take the whole app down with it.
   --------------------------------------------------------------------------- */
function idbOpen() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const os = db.createObjectStore(STORE, { keyPath: 'id' });
                os.createIndex('kind_at', ['kind', 'at']);
                os.createIndex('at', 'at');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB blocked'));
        req.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
    });
}
function idbRun(db, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const out = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    });
}
function idbAll(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
        tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    });
}

const memory = new Map();

/* ---------------------------------------------------------------------------
   The journal itself. `use()` picks the backend; everything else is the same
   four operations whichever one is in play.
   --------------------------------------------------------------------------- */
export const journal = {
    mode: 'idb',          // idb | cloud | memory
    ready: false,
    error: null,
    cloud: null,          // { fs, db, uid } — set by the app when Firestore is up
    /* Called when a write is refused. A rejected write must never be silent:
       offline the SDK queues and nothing fires, so anything that reaches here
       is a real refusal — rules not published, quota, a bad row — and the
       entry the person just made is not going to survive a reload. */
    onError: null,
    _db: null,
    _fail(e) { this.error = e; if (this.onError) try { this.onError(e); } catch (x) {} },

    /** Choose where records live. Returns the mode actually in use. */
    async use(mode, cloud) {
        this.cloud = cloud || null;
        if (mode === 'cloud' && cloud && cloud.fs && cloud.db && cloud.uid) { this.mode = 'cloud'; this.ready = true; this.error = null; return 'cloud'; }
        if (mode === 'memory') { this.mode = 'memory'; this.ready = true; return 'memory'; }
        try {
            this._db = this._db || await idbOpen();
            this.mode = 'idb'; this.ready = true; this.error = null;
        } catch (e) {
            this.mode = 'memory'; this.ready = true; this.error = e;
        }
        return this.mode;
    },

    _coll() { return this.cloud.fs.collection(this.cloud.db, 'users', this.cloud.uid, 'journal'); },
    _doc(id) { return this.cloud.fs.doc(this.cloud.db, 'users', this.cloud.uid, 'journal', String(id)); },

    /** Every record, oldest first. `kinds` narrows it; omit for all of them. */
    async all(kinds) {
        const want = kinds ? [].concat(kinds) : null;
        let rows = [];
        try {
            if (this.mode === 'cloud') {
                /* One read of the collection, filtered here. Firestore would need a
                   composite index to filter by kind and order by time at once, and
                   that is a console step this app should not ask anyone to do. */
                const snap = await this.cloud.fs.getDocs(this._coll());
                snap.forEach(d => rows.push(Object.assign({ id: d.id }, d.data())));
            } else if (this.mode === 'memory') {
                rows = [...memory.values()].map(r => ({ ...r }));
            } else {
                rows = await idbAll(this._db);
            }
        } catch (e) { this.error = e; return []; }
        if (want) rows = rows.filter(r => want.includes(r.kind));
        return rows.sort((a, b) => (a.at || 0) - (b.at || 0));
    },

    /** Records of one kind between two timestamps, oldest first. */
    async range(kind, from, to) {
        const rows = await this.all(kind);
        return rows.filter(r => r.at >= from && r.at <= to);
    },

    /** Write one record. Same id overwrites, so an edit is just another put. */
    async put(rec) {
        const row = normalise(rec);
        if (!row) return null;
        try {
            if (this.mode === 'cloud') {
                const { id, ...rest } = row;
                /* Not awaited on purpose: offline the server ack never settles, and
                   the SDK's own cache has already accepted the write. */
                this.cloud.fs.setDoc(this._doc(id), rest).catch(e => this._fail(e));
            } else if (this.mode === 'memory') {
                memory.set(row.id, row);
            } else {
                await idbRun(this._db, 'readwrite', os => os.put(row));
            }
            this.error = null;
        } catch (e) { this._fail(e); }
        return row;
    },

    /** Write many at once — used by the importer and by the sign-in merge. */
    async putMany(recs) {
        const rows = (recs || []).map(normalise).filter(Boolean);
        if (!rows.length) return 0;
        try {
            if (this.mode === 'cloud') {
                /* Firestore batches cap at 500 writes. */
                for (let i = 0; i < rows.length; i += 400) {
                    const batch = this.cloud.fs.writeBatch(this.cloud.db);
                    rows.slice(i, i + 400).forEach(r => { const { id, ...rest } = r; batch.set(this._doc(id), rest); });
                    await batch.commit();
                }
            } else if (this.mode === 'memory') {
                rows.forEach(r => memory.set(r.id, r));
            } else {
                await idbRun(this._db, 'readwrite', os => rows.forEach(r => os.put(r)));
            }
            this.error = null;
        } catch (e) { this._fail(e); return 0; }
        return rows.length;
    },

    async remove(id) {
        try {
            if (this.mode === 'cloud') await this.cloud.fs.deleteDoc(this._doc(id));
            else if (this.mode === 'memory') memory.delete(String(id));
            else await idbRun(this._db, 'readwrite', os => os.delete(String(id)));
        } catch (e) { this.error = e; }
    },

    /** Delete everything, or everything of one kind. */
    async clear(kind) {
        try {
            if (!kind && this.mode === 'idb') { await idbRun(this._db, 'readwrite', os => os.clear()); return; }
            if (!kind && this.mode === 'memory') { memory.clear(); return; }
            const rows = await this.all(kind);
            if (this.mode === 'cloud') {
                for (let i = 0; i < rows.length; i += 400) {
                    const batch = this.cloud.fs.writeBatch(this.cloud.db);
                    rows.slice(i, i + 400).forEach(r => batch.delete(this._doc(r.id)));
                    await batch.commit();
                }
            } else {
                for (const r of rows) await this.remove(r.id);
            }
        } catch (e) { this.error = e; }
    },

    /** How many of each kind, and roughly how much room they take. */
    async stats() {
        const rows = await this.all();
        const counts = {};
        rows.forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1; });
        return { total: rows.length, counts, bytes: JSON.stringify(rows).length, oldest: rows.length ? rows[0].at : null };
    },

    /**
     * Copy records into wherever the journal now lives, keeping whichever copy
     * was written last. Signing in calls this with what was logged locally.
     */
    async merge(records) {
        const incoming = (records || []).map(normalise).filter(Boolean);
        if (!incoming.length) return 0;
        const have = new Map((await this.all()).map(r => [r.id, r]));
        const fresh = incoming.filter(r => {
            const mine = have.get(r.id);
            return !mine || (r.saved || 0) > (mine.saved || 0);
        });
        await this.putMany(fresh);
        return fresh.length;
    },

    label() {
        if (this.mode === 'cloud') return 'Firestore · users/' + (this.cloud ? this.cloud.uid : '…') + '/journal';
        if (this.mode === 'memory') return 'in memory only';
        return 'IndexedDB · ' + DB_NAME + '/' + STORE;
    }
};

/** Give a record the three fields the store indexes on, and drop the rest of the mess. */
function normalise(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const at = typeof rec.at === 'number' ? rec.at : Date.parse(rec.at || rec.start || '') || Date.now();
    const kind = String(rec.kind || '');
    if (!kind) return null;
    const id = String(rec.id || (kind + '-' + at + '-' + Math.random().toString(36).slice(2, 8)));
    return Object.assign({}, rec, { id, kind, at, saved: rec.saved || Date.now() });
}

export { normalise as normaliseRecord };
