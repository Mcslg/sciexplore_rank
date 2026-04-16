const API_URL = '/api/proxy';
const PREV_API_URL = './prev_data.json';
const HISTORY_URL = './history.csv';

const elements = {
    rankingBody: document.getElementById('rankingBody'),
    totalWorks: document.getElementById('total-works'),
    updateTime: document.getElementById('update-time'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    groupFilter: document.getElementById('groupFilter'),
    loader: document.getElementById('loader'),
    errorMsg: document.getElementById('error-msg'),
    trendModal: document.getElementById('trendModal'),
    modalTitle: document.getElementById('modalTitle'),
    closeModal: document.querySelector('.close')
};

let allData = [];
let prevDataMap = {};
let currentChart = null;

// 初始化
window.onload = fetchData;
elements.refreshBtn.addEventListener('click', fetchData);
elements.searchInput.addEventListener('input', applyFilters);
elements.groupFilter.addEventListener('change', applyFilters);
elements.closeModal.onclick = () => elements.trendModal.style.display = 'none';
window.onclick = (event) => { if (event.target == elements.trendModal) elements.trendModal.style.display = 'none'; };

async function fetchData() {
    showLoader();
    try {
        // 同時抓取目前與前次資料
        const [res, prevRes] = await Promise.allSettled([
            fetch(API_URL),
            fetch(PREV_API_URL)
        ]);

        const data = (res.status === 'fulfilled' && res.value.ok) ? await res.value.json() : [];
        const prevData = (prevRes.status === 'fulfilled' && prevRes.value.ok) ? await prevRes.value.json() : [];

        // 轉換前次資料為 Map 方便快速查詢
        prevDataMap = {};
        prevData.forEach(item => {
            prevDataMap[item.resultid] = parseInt(item.vote_count) || 0;
        });

        allData = data.sort((a, b) => (parseInt(b.vote_count) || 0) - (parseInt(a.vote_count) || 0));
        
        // 更新組別篩選器
        const groups = [...new Set(allData.map(d => d.rgroup))].sort();
        const currentSelection = elements.groupFilter.value;
        elements.groupFilter.innerHTML = '<option value="all">所有組別</option>' + 
            groups.map(g => `<option value="${g}" ${g===currentSelection?'selected':''}>${g}</option>`).join('');

        elements.updateTime.innerText = new Date().toLocaleTimeString();
        applyFilters();
    } catch (e) {
        console.error(e);
        document.getElementById('error-msg').style.display = 'flex';
    } finally {
        hideLoader();
    }
}

function applyFilters() {
    const term = elements.searchInput.value.toLowerCase();
    const group = elements.groupFilter.value;
    const filtered = allData.filter(d => 
        (d.rtitle.toLowerCase().includes(term) || d.resultid.toLowerCase().includes(term)) &&
        (group === 'all' || d.rgroup === group)
    );
    elements.totalWorks.innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(data) {
    elements.rankingBody.innerHTML = '';
    data.forEach((item, index) => {
        const currentVotes = parseInt(item.vote_count) || 0;
        const prevVotes = prevDataMap[item.resultid] || currentVotes;
        const growth = currentVotes - prevVotes;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div class="rank-badge">${index + 1}</div></td>
            <td>
                <div class="work-info">
                    <span class="work-title">${item.rtitle}</span>
                    <span class="work-id"># ${item.resultid}</span>
                </div>
            </td>
            <td><span class="group-tag">${item.rgroup}</span></td>
            <td class="vote-col"><strong>${currentVotes}</strong> <small>票</small></td>
            <td class="growth-col">
                <span class="growth-badge ${growth > 0 ? 'growth-positive' : 'growth-zero'}">
                    ${growth > 0 ? '+' : ''}${growth}
                </span>
            </td>
            <td class="action-col">
                <button class="btn-detail" onclick="showTrend('${item.resultid}', '${item.rtitle}')" title="查看趨勢">
                    <i class="fas fa-chart-line"></i>
                </button>
                <button class="btn-detail" onclick="window.open('https://sciexplore2026.colife.org.tw/work/detail.php?id=${item.resultid}', '_blank')" title="官方頁面">
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </td>
        `;
        elements.rankingBody.appendChild(tr);
    });
}

async function showTrend(id, title) {
    elements.trendModal.style.display = 'flex';
    elements.modalTitle.innerText = `${title} - 票數趨勢`;
    
    try {
        const res = await fetch(HISTORY_URL);
        const text = await res.text();
        const lines = text.split('\n').slice(1); // 跳過標題列
        
        const historyData = lines
            .map(line => line.split(','))
            .filter(cols => cols[1] === id)
            .map(cols => ({
                t: new Date(cols[0]),
                v: parseInt(cols[2])
            }))
            .sort((a, b) => a.t - b.t);

        const ctx = document.getElementById('trendChart').getContext('2d');
        if (currentChart) currentChart.destroy();

        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyData.map(d => d.t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})),
                datasets: [{
                    label: '累計票數',
                    data: historyData.map(d => d.v),
                    borderColor: '#696cff',
                    backgroundColor: 'rgba(105, 108, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    } catch (e) {
        console.error('無法讀取歷史資料', e);
    }
}

function showLoader() { elements.loader.style.display = 'flex'; }
function hideLoader() { elements.loader.style.display = 'none'; }
