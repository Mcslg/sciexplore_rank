const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCHIVE_DIR = path.join(PROJECT_ROOT, 'archive');
const HISTORY_DIR = path.join(ARCHIVE_DIR, 'history');
const OUTPUT_PATH = path.join(ARCHIVE_DIR, 'vote-history-compact.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toUnixSeconds(value) {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    return Math.floor(time / 1000);
}

function compactHistory(rows) {
    const compacted = [];
    let previousVote = null;

    rows.forEach((row, index) => {
        const timestamp = toUnixSeconds(row.created_at);
        if (timestamp === null) return;

        const voteCount = parseInt(row.vote_count, 10) || 0;
        const isEndpoint = index === 0 || index === rows.length - 1;
        const changed = voteCount !== previousVote;

        if (isEndpoint || changed) {
            const last = compacted[compacted.length - 1];
            if (!last || last[0] !== timestamp || last[1] !== voteCount) {
                compacted.push([timestamp, voteCount]);
            }
        }

        previousVote = voteCount;
    });

    return compacted;
}

function byteSize(value) {
    return Buffer.byteLength(value, 'utf8');
}

function main() {
    if (!fs.existsSync(HISTORY_DIR)) {
        throw new Error('Missing archive/history. Run npm run export:votes first.');
    }

    const latestPath = path.join(ARCHIVE_DIR, 'latest-results.json');
    const manifestPath = path.join(ARCHIVE_DIR, 'archive-manifest.json');
    const latestResults = fs.existsSync(latestPath) ? readJson(latestPath) : [];
    const sourceManifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : {};
    const historyFiles = fs.readdirSync(HISTORY_DIR).filter(file => file.endsWith('.json')).sort();

    const histories = {};
    let sourcePoints = 0;
    let compactPoints = 0;
    let sourceBytes = 0;

    historyFiles.forEach(file => {
        const filePath = path.join(HISTORY_DIR, file);
        const rows = readJson(filePath);
        const resultid = decodeURIComponent(path.basename(file, '.json'));
        const compacted = compactHistory(rows);

        histories[resultid] = compacted;
        sourcePoints += rows.length;
        compactPoints += compacted.length;
        sourceBytes += fs.statSync(filePath).size;
    });

    const output = {
        generated_at: new Date().toISOString(),
        source_generated_at: sourceManifest.generated_at || null,
        format: {
            history_point: ['unix_seconds', 'vote_count'],
            strategy: 'first point, last point, and vote-count changes'
        },
        total_works: latestResults.length || historyFiles.length,
        source_points: sourcePoints,
        compact_points: compactPoints,
        histories
    };

    const json = `${JSON.stringify(output)}\n`;
    fs.writeFileSync(OUTPUT_PATH, json);

    console.log(`Source history: ${(sourceBytes / 1024 / 1024).toFixed(2)} MB, ${sourcePoints} points`);
    console.log(`Compact history: ${(byteSize(json) / 1024 / 1024).toFixed(2)} MB, ${compactPoints} points`);
    console.log(`Wrote ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main();
