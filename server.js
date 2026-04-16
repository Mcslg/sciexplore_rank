const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 允許所有連線 (CORS)
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// 提供靜態網頁檔案
app.use(express.static(path.join(__dirname)));

// 代理 API 請求
app.post('/api/proxy', async (req, res) => {
    try {
        const response = await axios.post('https://sciexplore2026.colife.org.tw/work/prg/getWorkList.php', 
            new URLSearchParams(req.body).toString(),
            {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({ error: '無法獲取遠端資料' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器已啟動: http://localhost:${PORT}`);
    console.log(`👉 已自動掛載網頁，請直接訪問上方網址`);
});
