const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const ARCHIVE_DIR = path.join(PROJECT_ROOT, 'archive');
const HISTORY_DIR = path.join(ARCHIVE_DIR, 'history');
const PAGE_SIZE = 1000;

function loadDotEnv() {
    if (!fs.existsSync(ENV_PATH)) return;

    const content = fs.readFileSync(ENV_PATH, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) process.env[key] = value;
    });
}

function ensureDirs() {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function encodeHistoryFileName(resultid) {
    return `${encodeURIComponent(resultid)}.json`;
}

function createSupabaseClient() {
    const url = process.env.SUPABASE_URL || 'https://bazcoiuhgbgyyhfggjhv.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Put it in .env or export it before running this script.');
    }

    return createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

function isNewerRow(row, current) {
    if (!current) return true;

    const rowTime = new Date(row.created_at).getTime();
    const currentTime = new Date(current.created_at).getTime();

    if (rowTime !== currentTime) return rowTime > currentTime;
    return (row.id || 0) > (current.id || 0);
}

async function fetchPage(supabase, from) {
    const { data, error } = await supabase
        .from('votes')
        .select('id, resultid, rtitle, rgroup, vote_count, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    return data || [];
}

async function main() {
    loadDotEnv();
    ensureDirs();

    const supabase = createSupabaseClient();
    const histories = new Map();
    const latestByResult = new Map();
    let totalRows = 0;
    let from = 0;

    while (true) {
        const rows = await fetchPage(supabase, from);
        if (!rows.length) break;

        rows.forEach(row => {
            const resultid = String(row.resultid || '').trim();
            if (!resultid) return;

            if (!histories.has(resultid)) histories.set(resultid, []);
            histories.get(resultid).push({
                vote_count: parseInt(row.vote_count, 10) || 0,
                created_at: row.created_at
            });

            if (isNewerRow(row, latestByResult.get(resultid))) {
                latestByResult.set(resultid, row);
            }
        });

        totalRows += rows.length;
        process.stdout.write(`Fetched ${totalRows} rows\r`);

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    process.stdout.write(`Fetched ${totalRows} rows\n`);

    const historyManifest = {};
    histories.forEach((history, resultid) => {
        const file = encodeHistoryFileName(resultid);
        historyManifest[resultid] = `history/${file}`;
        fs.writeFileSync(path.join(HISTORY_DIR, file), `${JSON.stringify(history)}\n`);
    });

    const latestResults = [...latestByResult.values()]
        .map(row => ({
            resultid: row.resultid,
            rtitle: row.rtitle,
            rgroup: row.rgroup,
            vote_count: parseInt(row.vote_count, 10) || 0,
            created_at: row.created_at
        }))
        .sort((a, b) => b.vote_count - a.vote_count);

    const generatedAt = new Date().toISOString();
    fs.writeFileSync(path.join(ARCHIVE_DIR, 'latest-results.json'), `${JSON.stringify(latestResults, null, 2)}\n`);
    fs.writeFileSync(path.join(ARCHIVE_DIR, 'history-manifest.json'), `${JSON.stringify(historyManifest, null, 2)}\n`);
    fs.writeFileSync(path.join(ARCHIVE_DIR, 'archive-manifest.json'), `${JSON.stringify({
        generated_at: generatedAt,
        source_table: 'votes',
        total_rows: totalRows,
        total_works: latestResults.length,
        files: {
            latest_results: 'latest-results.json',
            history_manifest: 'history-manifest.json',
            history_dir: 'history/'
        }
    }, null, 2)}\n`);

    console.log(`Wrote ${latestResults.length} works to ${path.relative(PROJECT_ROOT, ARCHIVE_DIR)}`);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
