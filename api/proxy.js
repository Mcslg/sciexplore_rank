const axios = require('axios');

module.exports = async (req, res) => {
    // 允許跨網域請求
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const response = await axios.post('https://sciexplore2026.colife.org.tw/work/prg/getWorkList.php', 
            'type=all',
            {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );
        res.status(200).json(response.data[0]);
    } catch (error) {
        res.status(500).json({ error: '即時連線失敗', message: error.message });
    }
};
