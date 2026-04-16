const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 500;

async function fetchAll(buildQuery) {
    let from = 0;
    const rows = [];

    while (true) {
        const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE_SIZE) return rows;
        from += PAGE_SIZE;
    }
}

function getHourBucket(createdAt) {
    const time = new Date(createdAt).getTime();
    if (Number.isNaN(time)) return null;
    return Math.floor(time / HOUR_MS);
}

function pickRowsToDelete(rows) {
    const keepByBucket = new Map();

    rows.forEach(row => {
        const bucket = getHourBucket(row.created_at);
        if (bucket === null) return;

        const key = `${row.resultid}:${bucket}`;
        const current = keepByBucket.get(key);
        const rowTime = new Date(row.created_at).getTime();
        const currentTime = current ? new Date(current.created_at).getTime() : -Infinity;

        if (!current || rowTime > currentTime || (rowTime === currentTime && row.id > current.id)) {
            keepByBucket.set(key, row);
        }
    });

    const keepIds = new Set([...keepByBucket.values()].map(row => row.id));
    return rows.filter(row => !keepIds.has(row.id)).map(row => row.id);
}

async function deleteInBatches(supabase, ids) {
    let deleted = 0;

    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
        const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
        const { error } = await supabase.from('votes').delete().in('id', batch);
        if (error) throw error;
        deleted += batch.length;
    }

    return deleted;
}

async function compactOldVotes(supabase, options = {}) {
    const now = options.now || Date.now();
    const full = options.full === true;
    const dryRun = options.dryRun === true;
    const cutoff = new Date(now - DAY_MS).toISOString();
    const windowStart = new Date(now - DAY_MS - 2 * HOUR_MS).toISOString();

    const compactRows = await fetchAll(() => {
        let query = supabase
            .from('votes')
            .select('id, resultid, created_at')
            .lt('created_at', cutoff);

        if (!full) query = query.gte('created_at', windowStart);
        return query.order('created_at', { ascending: true });
    });

    const deleteIds = pickRowsToDelete(compactRows);
    const deleted = dryRun ? 0 : await deleteInBatches(supabase, deleteIds);

    return {
        success: true,
        cutoff,
        mode: full ? 'full' : 'rolling',
        dryRun,
        scanned: compactRows.length,
        kept: compactRows.length - deleteIds.length,
        deleted: dryRun ? 0 : deleted,
        wouldDelete: deleteIds.length
    };
}

module.exports = {
    compactOldVotes
};
