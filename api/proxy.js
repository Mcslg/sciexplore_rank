const axios = require('axios');

function parseTeamJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

function getSchoolName(item) {
    if (item.rschool) return item.rschool;

    const studentTeam = parseTeamJson(item.team_std || item[6]);
    const teacherTeam = parseTeamJson(item.team_teacher || item[5]);
    const candidates = [
        ...(studentTeam?.std || []),
        ...(teacherTeam?.teach || [])
    ];
    const schools = [...new Set(candidates.map(person => person.schoolName).filter(Boolean))];
    return schools.join('、');
}

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
        const normalized = (response.data[0] || []).map(item => ({
            ...item,
            rschool: getSchoolName(item)
        }));
        res.status(200).json(normalized);
    } catch (error) {
        res.status(500).json({ error: '即時連線失敗', message: error.message });
    }
};
