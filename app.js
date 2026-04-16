const API_URL = '/api/proxy';
const DATA_URL = './data.json';
const PREV_URL = './prev_data.json';
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
    closeModal: document.querySelector('.close'),
    followCount: document.getElementById('follow-count'),
    compareList: document.getElementById('compare-list')
};

let liveData = [];
let dataMap = {};
let prevDataMap = {};
let historyMap = {};
let followList = JSON.parse(localStorage.getItem('followList') || '[]');
let currentChart = null;
let multiChart = null;

window.onload = fetchData;
elements.refreshBtn.addEventListener('click', fetchData);
elements.searchInput.addEventListener('input', applyFilters);
elements.groupFilter.addEventListener('change', applyFilters);
elements.closeModal.onclick = () => elements.trendModal.style.display = 'none';

async function fetchData() {
    showLoader();
    try {
        const [resLive, resData, resPrev, resHistory] = await Promise.allSettled([
            fetch(API_URL), fetch(DATA_URL), fetch(PREV_URL), fetch(HISTORY_URL)
        ]);
        const liveRaw = (resLive.status === 'fulfilled' && resLive.value.ok) ? await resLive.value.json() : [];
        const dataRaw = (resData.status === 'fulfilled' && resData.value.ok) ? await resData.value.json() : [];
        const prevRaw = (resPrev.status === 'fulfilled' && resPrev.value.ok) ? await resPrev.value.json() : [];
        const historyText = (resHistory.status === 'fulfilled' && resHistory.value.ok) ? await resHistory.value.text() : '';

        historyMap = {};
        if (historyText) {
            historyText.split('\n').slice(1).forEach(line => {
                const [time, id, count] = line.split(',');
                if (!id) return;
                if (!historyMap[id]) historyMap[id] = [];
                historyMap[id].push({ t: new Date(time), v: parseInt(count) || 0 });
            });
        }

        dataMap = {}; dataRaw.forEach(d => dataMap[d.resultid] = parseInt(d.vote_count) || 0);
        prevDataMap = {}; prevRaw.forEach(d => prevDataMap[d.resultid] = parseInt(d.vote_count) || 0);
        liveData = liveRaw.sort((a, b) => (parseInt(b.vote_count) || 0) - (parseInt(a.vote_count) || 0));
        
        const groups = [...new Set(liveData.map(d => d.rgroup))].sort();
        elements.groupFilter.innerHTML = '<option value="all">所有組別</option>' + 
            groups.map(g => `<option value="${g}">${g}</option>`).join('');

        updateFollowCount();
        applyFilters();
    } catch (e) {
        console.error(e);
        elements.errorMsg.style.display = 'flex';
    } finally {
        hideLoader();
    }
}

function switchTab(view) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(view + '-view').style.display = 'block';
    event.currentTarget.classList.add('active');
    if (view === 'compare') renderMultiChart();
}

function toggleFollow(id) {
    const idx = followList.indexOf(id);
    if (idx === -1) followList.push(id);
    else followList.splice(idx, 1);
    localStorage.setItem('followList', JSON.stringify(followList));
    updateFollowCount();
    applyFilters();
}

function updateFollowCount() {
    elements.followCount.innerText = followList.length;
}

function clearFollows() {
    followList = [];
    localStorage.removeItem('followList');
    updateFollowCount();
    renderMultiChart();
    applyFilters();
}

function generateSparkline(id, currentVotes) {
    const pts = (historyMap[id] || []).map(p => p.v);
    const points = [...pts, currentVotes].slice(-10);
    if (points.length < 2) return '';
    const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
    const width = 80, height = 26, step = width / (points.length - 1);
    const coords = points.map((v, i) => `${i * step},${height - ((v - min) / range * height) + 2}`).join(' ');
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height + 4}"><polyline points="${coords}" /></svg>`;
}

function applyFilters() {
    const term = elements.searchInput.value.toLowerCase();
    const group = elements.groupFilter.value;
    const filtered = liveData.filter(d => 
        (d.rtitle.toLowerCase().includes(term) || d.resultid.toLowerCase().includes(term)) &&
        (group === 'all' || d.rgroup === group)
    );
    elements.totalWorks.innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(data) {
    elements.rankingBody.innerHTML = '';
    data.forEach((item, index) => {
        const cur = parseInt(item.vote_count) || 0;
        const growth1 = cur - (dataMap[item.resultid] || cur);
        const growth2 = (dataMap[item.resultid] || cur) - (prevDataMap[item.resultid] || (dataMap[item.resultid] || cur));
        const isFollowed = followList.includes(item.resultid);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="follow-col"><i class="fa-star ${isFollowed ? 'fas active' : 'far'}" onclick="toggleFollow('${item.resultid}')"></i></td>
            <td><div class="rank-badge">${index + 1}</div></td>
            <td><div class="work-info"><span class="work-title">${item.rtitle}</span><span class="work-id"># ${item.resultid}</span></div></td>
            <td><span class="group-tag">${item.rgroup}</span></td>
            <td class="vote-col"><strong>${cur}</strong></td>
            <td class="trend-col">${generateSparkline(item.resultid, cur)}</td>
            <td class="growth-col">
                <div class="growth-container">
                    <div class="growth-row"><small>即時</small><span class="growth-badge ${growth1 > 0 ? 'growth-positive' : 'growth-zero'}">${growth1 > 0 ? '+' : ''}${growth1}</span></div>
                    <div class="growth-row"><small>上期</small><span class="growth-badge ${growth2 > 0 ? 'growth-positive' : 'growth-zero'}">${growth2 > 0 ? '+' : ''}${growth2}</span></div>
                </div>
            </td>
            <td class="action-col">
                <button class="btn-detail" onclick="showTrend('${item.resultid}', '${item.rtitle}')"><i class="fas fa-chart-line"></i></button>
            </td>
        `;
        elements.rankingBody.appendChild(tr);
    });
}

function renderMultiChart() {
    const ctx = document.getElementById('multiTrendChart').getContext('2d');
    if (multiChart) multiChart.destroy();
    
    elements.compareList.innerHTML = '';
    const datasets = followList.map((id, index) => {
        const work = liveData.find(d => d.resultid === id);
        const history = (historyMap[id] || []).sort((a,b) => a.t - b.t);
        const color = `hsl(${(index * 137) % 360}, 70%, 60%)`;
        
        if (work) {
            const tag = document.createElement('span');
            tag.className = 'compare-tag';
            tag.style.color = color;
            tag.style.borderColor = color;
            tag.innerText = work.rtitle;
            elements.compareList.appendChild(tag);
        }

        return {
            label: work ? work.rtitle : id,
            data: history.map(h => ({ x: h.t, y: h.v })),
            borderColor: color,
            tension: 0.3,
            fill: false
        };
    });

    multiChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'hour' }, grid: { display: false } },
                y: { beginAtZero: false }
            }
        }
    });
}

async function showTrend(id, title) {
    elements.trendModal.style.display = 'flex';
    elements.modalTitle.innerText = title;
    const history = (historyMap[id] || []).sort((a,b) => a.t - b.t);
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (currentChart) currentChart.destroy();
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(d => d.t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})),
            datasets: [{ label: '票數', data: history.map(d => d.v), borderColor: '#696cff', tension: 0.4 }]
        }
    });
}

function showLoader() { elements.loader.style.display = 'flex'; }
function hideLoader() { elements.loader.style.display = 'none'; }
