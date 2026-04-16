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
            const now = Date.now();
            const fifteenMinsAgo = new Date(now - 15 * 60 * 1000).toISOString();
            const thirtyMinsAgo = new Date(now - 30 * 60 * 1000).toISOString();
            const lookback = new Date(now - 90 * 60 * 1000).toISOString();

            // 抓足夠長的歷史，才能找出「15 分鐘前」和「30 分鐘前」各自最近的一筆。
            const { data, error } = await supabase
                .from('votes').select('resultid, vote_count, created_at')
                .gte('created_at', lookback).order('created_at', { ascending: false });

            if (error) throw error;

            const map15m = {};
            const map30m = {};
            const time15 = new Date(fifteenMinsAgo).getTime();
            const time30 = new Date(thirtyMinsAgo).getTime();

            data.forEach(item => {
                const itemTime = new Date(item.created_at).getTime();
                const voteCount = parseInt(item.vote_count, 10) || 0;
                
                if (itemTime < time15 && !map15m[item.resultid]) {
                    map15m[item.resultid] = voteCount;
                }
                if (itemTime < time30 && !map30m[item.resultid]) {
                    map30m[item.resultid] = voteCount;
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
