const API_URL = '/api/proxy';
const HISTORY_API = '/api/history';

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
let dataMap15 = {};   // 15m 前
let dataMap30 = {};   // 30m 前
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
        const [resLive, resSnap, resSpark] = await Promise.allSettled([
            fetch(API_URL),
            fetch(`${HISTORY_API}?mode=snapshot`),
            fetch(`${HISTORY_API}?mode=sparkline`)
        ]);

        const liveRaw = (resLive.status === 'fulfilled' && resLive.value.ok) ? await resLive.value.json() : [];
        const snapRaw = (resSnap.status === 'fulfilled' && resSnap.value.ok) ? await resSnap.value.json() : { snapshot15: {}, snapshot30: {} };
        historyMap = (resSpark.status === 'fulfilled' && resSpark.value.ok) ? await resSpark.value.json() : {};

        dataMap15 = snapRaw.snapshot15;
        dataMap30 = snapRaw.snapshot30;

        liveData = liveRaw.sort((a, b) => (parseInt(b.vote_count) || 0) - (parseInt(a.vote_count) || 0));
        
        const groups = [...new Set(liveData.map(d => d.rgroup))].sort();
        const currentSelection = elements.groupFilter.value;
        elements.groupFilter.innerHTML = '<option value="all">所有組別 (總排行)</option>' + 
            groups.map(g => `<option value="${g}" ${g===currentSelection?'selected':''}>${g}</option>`).join('');

        elements.updateTime.innerText = new Date().toLocaleTimeString();
        updateFollowCount();
        applyFilters();
    } catch (e) {
        console.error(e);
        elements.errorMsg.style.display = 'flex';
    } finally {
        hideLoader();
    }
}

function getGroupColorClass(group) {
    if (group.includes('國小')) return 'group-elementary';
    if (group.includes('國中')) return 'group-middle';
    if (group.includes('高中') || group.includes('中職')) return 'group-high';
    if (group.includes('教師')) return 'group-teacher';
    return '';
}

function generateSparkline(id, currentVotes) {
    const points = historyMap[id] || [];
    if (points.length < 2) return '';
    const data = [...points, currentVotes].slice(-10);
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const width = 80, height = 26, step = width / (data.length - 1);
    const coords = data.map((v, i) => `${i * step},${height - ((v - min) / range * height) + 2}`).join(' ');
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height + 4}"><polyline points="${coords}" /></svg>`;
}

function applyFilters() {
    const term = elements.searchInput.value.toLowerCase();
    const group = elements.groupFilter.value;
    let rankBase = (group === 'all') ? liveData : liveData.filter(d => d.rgroup === group);
    const rankedData = rankBase.map((item, index) => ({ ...item, tempRank: index + 1 }));
    const filtered = rankedData.filter(d => d.rtitle.toLowerCase().includes(term) || d.resultid.toLowerCase().includes(term) || (d.rschool && d.rschool.toLowerCase().includes(term)));
    elements.totalWorks.innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(data) {
    elements.rankingBody.innerHTML = '';
    data.forEach((item) => {
        const cur = parseInt(item.vote_count) || 0;
        const last15 = dataMap15[item.resultid] || cur;
        const last30 = dataMap30[item.resultid] || last15;

        const growthLive = cur - last15;
        const growthPrev = last15 - last30;
        
        const isFollowed = followList.includes(item.resultid);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="follow-col"><i class="fa-star ${isFollowed ? 'fas active' : 'far'}" onclick="toggleFollow('${item.resultid}')"></i></td>
            <td><div class="rank-badge">${item.tempRank}</div></td>
            <td>
                <div class="work-info">
                    <span class="work-title">${item.rtitle}</span>
                    <div class="work-meta">
                        <span class="work-id"># ${item.resultid}</span>
                        <span class="school-tag"><i class="fas fa-school"></i> ${item.rschool || '未提供'}</span>
                    </div>
                </div>
            </td>
            <td><span class="group-tag ${getGroupColorClass(item.rgroup)}">${item.rgroup}</span></td>
            <td class="vote-col"><strong>${cur}</strong></td>
            <td class="trend-col">${generateSparkline(item.resultid, cur)}</td>
            <td class="growth-col">
                <div class="growth-container">
                    <div class="growth-row"><small>即時</small><span class="growth-badge ${growthLive > 0 ? 'growth-positive' : 'growth-zero'}">${growthLive > 0 ? '+' : ''}${growthLive}</span></div>
                    <div class="growth-row"><small>上期</small><span class="growth-badge ${growthPrev > 0 ? 'growth-positive' : 'growth-zero'}">${growthPrev > 0 ? '+' : ''}${growthPrev}</span></div>
                </div>
            </td>
            <td class="action-col">
                <button class="btn-detail" onclick="showTrend('${item.resultid}', '${item.rtitle}')" title="趨勢圖"><i class="fas fa-chart-line"></i></button>
                <button class="btn-detail" onclick="window.open('https://sciexplore2026.colife.org.tw/work/detail.php?id=${item.resultid}', '_blank')" title="官網詳情"><i class="fas fa-external-link-alt"></i></button>
            </td>
        `;
        elements.rankingBody.appendChild(tr);
    });
}

function switchTab(view) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(view + '-view').style.display = 'block';
    if (event) event.currentTarget.classList.add('active');
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

function updateFollowCount() { elements.followCount.innerText = followList.length; }
function clearFollows() { followList = []; localStorage.removeItem('followList'); updateFollowCount(); renderMultiChart(); applyFilters(); }

async function renderMultiChart() {
    const ctx = document.getElementById('multiTrendChart').getContext('2d');
    if (multiChart) multiChart.destroy();
    elements.compareList.innerHTML = '<p>載入對比中...</p>';
    try {
        const promises = followList.map(id => fetch(`${HISTORY_API}?id=${id}`).then(res => res.json()));
        const results = await Promise.all(promises);
        elements.compareList.innerHTML = '';
        const datasets = followList.map((id, index) => {
            const work = liveData.find(d => d.resultid === id);
            const history = results[index].map(d => ({ x: new Date(d.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), y: d.vote_count }));
            const color = `hsl(${(index * 137) % 360}, 70%, 60%)`;
            if (work) {
                const tag = document.createElement('span'); tag.className = 'compare-tag'; tag.style.color = color; tag.style.borderColor = color; tag.innerText = work.rtitle;
                elements.compareList.appendChild(tag);
            }
            return { label: work ? work.rtitle : id, data: history, borderColor: color, tension: 0.3, fill: false };
        });
        multiChart = new Chart(ctx, { type: 'line', data: { datasets }, options: { responsive: true, maintainAspectRatio: false } });
    } catch (e) { elements.compareList.innerHTML = '<p>讀取失敗</p>'; }
}

async function showTrend(id, title) {
    elements.trendModal.style.display = 'flex';
    elements.modalTitle.innerText = title;
    try {
        const res = await fetch(`${HISTORY_API}?id=${id}`);
        const historyData = await res.json();
        const processed = historyData.map(d => ({ t: new Date(d.created_at), v: d.vote_count })).sort((a,b) => a.t - b.t);
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: processed.map(d => d.t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})),
                datasets: [{ label: '票數', data: processed.map(d => d.v), borderColor: '#696cff', tension: 0.4 }]
            }
        });
    } catch (e) { console.error('圖表載入失敗', e); }
}

function showLoader() { elements.loader.style.display = 'flex'; }
function hideLoader() { elements.loader.style.display = 'none'; }
