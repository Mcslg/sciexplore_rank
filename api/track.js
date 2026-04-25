const axios = require('axios');
const { compactOldVotes } = require('./compact-utils');

const supabase = require('./supabase-client');

function getRequestSecret(req) {
    const authHeader = req.headers.authorization || '';
    const bearerPrefix = 'Bearer ';

    if (authHeader.startsWith(bearerPrefix)) {
        return authHeader.slice(bearerPrefix.length);
    }

    return req.query.secret;
}

module.exports = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = getRequestSecret(req);

    if (!cronSecret) {
        return res.status(500).json({ error: 'Missing CRON_SECRET. Set it before exposing /api/track.' });
    }

    if (requestSecret !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const response = await axios.post('https://sciexplore2026.colife.org.tw/work/prg/getWorkList.php', 'type=all', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const rawData = response.data[0];
        if (!rawData) throw new Error('無法從官方獲取資料');

        // 整理資料準備批次寫入
        const votesToInsert = rawData.map(item => ({
            resultid: item.resultid,
            rtitle: item.rtitle,
            rgroup: item.rgroup,
            vote_count: parseInt(item.vote_count) || 0
        }));

        // 寫入 Supabase (採用批次寫入)
        const { error } = await supabase.from('votes').insert(votesToInsert);
        
        if (error) throw error;

        let compact = null;
        try {
            compact = await compactOldVotes(supabase);
        } catch (compactError) {
            console.error('Compact Error:', compactError.message);
            compact = { success: false, error: compactError.message };
        }

        res.status(200).json({
            success: true,
            count: votesToInsert.length,
            time: new Date().toISOString(),
            compact
        });
    } catch (error) {
        console.error('Tracking Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
