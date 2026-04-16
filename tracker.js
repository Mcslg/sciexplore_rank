const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://sciexplore2026.colife.org.tw/work/prg/getWorkList.php';
const DATA_FILE = path.join(__dirname, 'data.json');
const PREV_DATA_FILE = path.join(__dirname, 'prev_data.json');
const HISTORY_FILE = path.join(__dirname, 'history.csv');

async function track() {
    console.log('--- 開始抓取資料 ---');
    try {
        const response = await axios.post(API_URL, 'type=all', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data = response.data[0];
        if (!data || !Array.isArray(data)) throw new Error('資料格式錯誤');

        // 1. 在更新之前，把現有的 data.json 變成 prev_data.json
        if (fs.existsSync(DATA_FILE)) {
            fs.copyFileSync(DATA_FILE, PREV_DATA_FILE);
            console.log('✅ 已備份舊資料至 prev_data.json');
        }

        // 2. 更新 data.json (給網頁前端直接使用)
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('✅ 已更新 data.json');


        // 2. 更新 history.csv (記錄時間、ID、票數)
        // 格式: timestamp, resultid, vote_count
        const timestamp = new Date().toISOString();
        const historyEntries = data.map(item => `${timestamp},${item.resultid},${item.vote_count}`).join('\n');
        
        // 如果檔案不存在，先加標題列
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.writeFileSync(HISTORY_FILE, 'timestamp,resultid,vote_count\n');
        }
        
        fs.appendFileSync(HISTORY_FILE, historyEntries + '\n');
        console.log('✅ 已追加資料至 history.csv');

    } catch (error) {
        console.error('❌ 抓取失敗:', error.message);
        process.exit(1);
    }
}

track();
