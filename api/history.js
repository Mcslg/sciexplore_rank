const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bazcoiuhgbgyyhfggjhv.supabase.co',
    'sb_publishable_5AIk0L_JevietDyF9_7w1w_oHBLmIO9'
);

module.exports = async (req, res) => {
    const { id, mode } = req.query;

    try {
        if (mode === 'sparkline') {
            const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('votes').select('resultid, vote_count, created_at')
                .gt('created_at', twoHoursAgo).order('created_at', { ascending: true });
            if (error) throw error;
            const sparkMap = {};
            data.forEach(item => {
                if (!sparkMap[item.resultid]) sparkMap[item.resultid] = [];
                sparkMap[item.resultid].push(item.vote_count);
            });
            return res.status(200).json(sparkMap);
        }

        if (mode === 'snapshot') {
            // 同時撈出 15m 前與 30m 前的紀錄
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

            // 抓取 30 分鐘內的所有紀錄
            const { data, error } = await supabase
                .from('votes').select('resultid, vote_count, created_at')
                .gt('created_at', thirtyMinsAgo).order('created_at', { ascending: false });

            if (error) throw error;

            const map15m = {};
            const map30m = {};

            data.forEach(item => {
                const itemTime = new Date(item.created_at).getTime();
                const time15 = new Date(fifteenMinsAgo).getTime();
                
                // 如果這筆是在 15m 之前的最新一筆，就當 15m 快照
                if (itemTime < time15 && !map15m[item.resultid]) {
                    map15m[item.resultid] = item.vote_count;
                }
                // 最新一筆超過 30m 之前的，不論如何都當 30m 快照的一個參考
                if (!map30m[item.resultid]) {
                    map30m[item.resultid] = item.vote_count;
                }
            });

            return res.status(200).json({ snapshot15: map15m, snapshot30: map30m });
        }

        if (id) {
            const { data, error } = await supabase
                .from('votes').select('vote_count, created_at')
                .eq('resultid', id).order('created_at', { ascending: true });
            if (error) throw error;
            return res.status(200).json(data);
        }
        res.status(400).json({ error: 'Missing params' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
