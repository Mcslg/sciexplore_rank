const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
    'https://bazcoiuhgbgyyhfggjhv.supabase.co',
    'sb_publishable_5AIk0L_JevietDyF9_7w1w_oHBLmIO9'
);

module.exports = async (req, res) => {
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

        res.status(200).json({ success: true, count: votesToInsert.length, time: new Date().toISOString() });
    } catch (error) {
        console.error('Tracking Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
