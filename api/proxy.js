const axios = require('axios');

module.exports = async (req, res) => {
    // 處理 CORS (雖然 Vercel API 預設允許，但手動加上更保險)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: '僅支援 POST 請求' });
    }

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
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Vercel Proxy Error:', error.message);
        res.status(500).json({ error: '無法從遠端獲取資料' });
    }
};
