const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    'https://bazcoiuhgbgyyhfggjhv.supabase.co',
    'sb_publishable_5AIk0L_JevietDyF9_7w1w_oHBLmIO9'
);

async function migrate() {
    console.log('🚀 開始遷移歷史數據...');
    
    const csvPath = path.join(__dirname, 'history.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('❌ 找不到 history.csv 檔案');
        return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(','); // timestamp,resultid,vote_count

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const [timestamp, id, count] = lines[i].split(',');
        if (!id || !count) continue;
        
        records.push({
            resultid: id,
            vote_count: parseInt(count) || 0,
            created_at: timestamp
        });
    }

    console.log(`統計：共發現 ${records.length} 筆紀錄。`);

    // 分批匯入，每批 1000 筆
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        process.stdout.write(`正在匯入第 ${i + 1} ~ ${Math.min(i + batchSize, records.length)} 筆... `);
        
        const { error } = await supabase.from('votes').insert(batch);
        
        if (error) {
            console.error('\n❌ 匯入失敗:', error.message);
            // 繼續嘗試下一批
        } else {
            console.log('✅ 成功');
        }
    }

    console.log('\n🎉 所有歷史數據遷移完成！');
}

migrate();
