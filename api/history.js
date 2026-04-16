const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bazcoiuhgbgyyhfggjhv.supabase.co',
    'sb_publishable_5AIk0L_JevietDyF9_7w1w_oHBLmIO9'
);

module.exports = async (req, res) => {
    const { id, mode } = req.query;

    try {
        if (mode === 'snapshot') {
            // 模式 A: 抓取大約 15 分鐘前的快照（用來算出增長量）
            // 我們找 12~18 分鐘前的那一組數據
            const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('votes')
                .select('resultid, vote_count, created_at')
                .lt('created_at', fifteenMinsAgo)
                .order('created_at', { ascending: false })
                .limit(1500); // 預估作品總數

            if (error) throw error;
            
            // 針對每個 ID 只取最近的那一筆
            const uniqueData = {};
            data.forEach(item => {
                if (!uniqueData[item.resultid]) uniqueData[item.resultid] = item.vote_count;
            });
            return res.status(200).json(uniqueData);
        }

        if (id) {
            // 模式 B: 抓取特定編號的所有歷史紀錄（畫圖表用）
            const { data, error } = await supabase
                .from('votes')
                .select('vote_count, created_at')
                .eq('resultid', id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return res.status(200).json(data);
        }

        res.status(400).json({ error: '請提供編號 (id) 或選取模式 (mode)' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
