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
    return schools.join('、') || '未提供';
}

function getSnapshotValue(map, id, fallback) {
    if (map && Object.prototype.hasOwnProperty.call(map, id)) {
        return parseInt(map[id], 10) || 0;
    }
    return fallback;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function parseHistoryTime(item) {
    return new Date(item.created_at || item.timestamp || item.time);
}

function formatChartTooltipTime(value) {
    return new Date(value).toLocaleString([], {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeScaleOptions() {
    return {
        type: 'time',
        time: {
            tooltipFormat: 'M/d HH:mm',
            displayFormats: {
                minute: 'HH:mm',
                hour: 'M/d HH:mm',
                day: 'M/d'
            }
        },
        ticks: {
            autoSkip: true,
            maxRotation: 0,
            callback(value) {
                return formatChartTooltipTime(value);
            }
        }
    };
}

function getTimeChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
            x: getTimeScaleOptions()
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title(items) {
                        if (!items.length) return '';
                        return formatChartTooltipTime(items[0].parsed.x);
                    }
                }
            }
        }
    };
}

function setChartStatus(target, message) {
    const status = document.getElementById(target);
    if (status) status.innerText = message || '';
}

function getFallbackTrendValues(id, currentVotes) {
    const last15 = getSnapshotValue(dataMap15, id, currentVotes);
    const last30 = getSnapshotValue(dataMap30, id, last15);
    return [last30, last15, currentVotes];
}

function normalizeTrendValues(values) {
    return values
        .map(v => parseInt(v, 10))
        .filter(v => Number.isFinite(v));
}

function generateSparkline(id, currentVotes) {
    const historyPoints = normalizeTrendValues(historyMap[id] || []);
    const data = (historyPoints.length >= 2 ? [...historyPoints, currentVotes] : getFallbackTrendValues(id, currentVotes)).slice(-10);
    if (data.length < 2) return '';

    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const width = 80, height = 26, padding = 3, step = width / (data.length - 1);
    const coords = data.map((v, i) => {
        const y = padding + (height - padding * 2) - ((v - min) / range * (height - padding * 2));
        return `${i * step},${y}`;
    }).join(' ');
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height + 4}"><polyline points="${coords}" /></svg>`;
}

function applyFilters() {
    const term = elements.searchInput.value.toLowerCase();
    const group = elements.groupFilter.value;
    let rankBase = (group === 'all') ? liveData : liveData.filter(d => d.rgroup === group);
    const rankedData = rankBase.map((item, index) => ({ ...item, tempRank: index + 1 }));
    const filtered = rankedData.filter(d => {
        const schoolName = getSchoolName(d).toLowerCase();
        return d.rtitle.toLowerCase().includes(term) ||
            d.resultid.toLowerCase().includes(term) ||
            schoolName.includes(term);
    });
    elements.totalWorks.innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(data) {
    elements.rankingBody.innerHTML = '';
    data.forEach((item) => {
        const cur = parseInt(item.vote_count) || 0;
        const last15 = getSnapshotValue(dataMap15, item.resultid, cur);
        const last30 = getSnapshotValue(dataMap30, item.resultid, last15);
        const schoolName = getSchoolName(item);

        const growthLive = cur - last15;
        const growthPrev = last15 - last30;
        
        const isFollowed = followList.includes(item.resultid);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="follow-col"><i class="fa-star follow-star ${isFollowed ? 'fas active' : 'far'}" title="加入關注"></i></td>
            <td><div class="rank-badge">${item.tempRank}</div></td>
            <td>
                <div class="work-info">
                    <span class="work-title">${escapeHtml(item.rtitle)}</span>
                    <div class="work-meta">
                        <span class="work-id"># ${escapeHtml(item.resultid)}</span>
                        <span class="school-tag"><i class="fas fa-school"></i> ${escapeHtml(schoolName)}</span>
                    </div>
                </div>
            </td>
            <td><span class="group-tag ${getGroupColorClass(item.rgroup)}">${escapeHtml(item.rgroup)}</span></td>
            <td class="vote-col"><strong>${cur}</strong></td>
            <td class="trend-col">${generateSparkline(item.resultid, cur)}</td>
            <td class="growth-col">
                <div class="growth-container">
                    <div class="growth-row"><small>即時</small><span class="growth-badge ${growthLive > 0 ? 'growth-positive' : 'growth-zero'}">${growthLive > 0 ? '+' : ''}${growthLive}</span></div>
                    <div class="growth-row"><small>上期</small><span class="growth-badge ${growthPrev > 0 ? 'growth-positive' : 'growth-zero'}">${growthPrev > 0 ? '+' : ''}${growthPrev}</span></div>
                </div>
            </td>
            <td class="action-col">
                <button class="btn-detail btn-trend" title="趨勢圖"><i class="fas fa-chart-line"></i></button>
                <button class="btn-detail btn-official" title="官網詳情"><i class="fas fa-external-link-alt"></i></button>
            </td>
        `;
        tr.querySelector('.follow-star').addEventListener('click', () => toggleFollow(item.resultid));
        tr.querySelector('.btn-trend').addEventListener('click', () => showTrend(item.resultid, item.rtitle));
        tr.querySelector('.btn-official').addEventListener('click', () => {
            window.open(`https://sciexplore2026.colife.org.tw/work/detail.php?id=${encodeURIComponent(item.resultid)}`, '_blank');
        });
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
    setChartStatus('compareChartStatus', '');
    if (typeof Chart === 'undefined') {
        setChartStatus('compareChartStatus', '圖表套件載入失敗，請重新整理頁面。');
        return;
    }
    elements.compareList.innerHTML = '<p>載入對比中...</p>';
    try {
        const promises = followList.map(id => fetch(`${HISTORY_API}?id=${id}`).then(res => res.json()));
        const results = await Promise.all(promises);
        elements.compareList.innerHTML = '';
        const datasets = followList.map((id, index) => {
            const work = liveData.find(d => d.resultid === id);
            const history = results[index]
                .map(d => ({ t: parseHistoryTime(d), y: parseInt(d.vote_count, 10) || 0 }))
                .filter(d => !Number.isNaN(d.t.getTime()))
                .map(d => ({ x: d.t.getTime(), y: d.y }));
            const color = `hsl(${(index * 137) % 360}, 70%, 60%)`;
            if (work) {
                const tag = document.createElement('span'); tag.className = 'compare-tag'; tag.style.color = color; tag.style.borderColor = color; tag.innerText = work.rtitle;
                elements.compareList.appendChild(tag);
            }
            return { label: work ? work.rtitle : id, data: history, borderColor: color, tension: 0.3, fill: false, pointRadius: 3 };
        });
        if (!datasets.some(dataset => dataset.data.length)) {
            setChartStatus('compareChartStatus', '目前還沒有可繪製的歷史資料。');
        }
        multiChart = new Chart(ctx, { type: 'line', data: { datasets }, options: getTimeChartOptions() });
    } catch (e) {
        console.error('對比圖載入失敗', e);
        elements.compareList.innerHTML = '<p>讀取失敗</p>';
        setChartStatus('compareChartStatus', '讀取趨勢資料失敗。');
    }
}

async function showTrend(id, title) {
    elements.trendModal.style.display = 'flex';
    elements.modalTitle.innerText = title;
    setChartStatus('trendChartStatus', '載入趨勢資料中...');
    try {
        if (typeof Chart === 'undefined') {
            setChartStatus('trendChartStatus', '圖表套件載入失敗，請重新整理頁面。');
            return;
        }
        const res = await fetch(`${HISTORY_API}?id=${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const historyData = await res.json();
        const processed = historyData
            .map(d => ({ t: parseHistoryTime(d), v: parseInt(d.vote_count, 10) || 0 }))
            .filter(d => !Number.isNaN(d.t.getTime()))
            .sort((a,b) => a.t - b.t);
        if (!processed.length) {
            const work = liveData.find(item => item.resultid === id);
            if (work) {
                const now = Date.now();
                getFallbackTrendValues(id, parseInt(work.vote_count, 10) || 0).forEach((value, index) => {
                    processed.push({ t: new Date(now - (2 - index) * 15 * 60 * 1000), v: value });
                });
            }
            setChartStatus('trendChartStatus', '目前只有即時票數，累積更多紀錄後會顯示完整趨勢。');
        } else {
            setChartStatus('trendChartStatus', '');
        }
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '票數',
                    data: processed.map(d => ({ x: d.t.getTime(), y: d.v })),
                    borderColor: '#696cff',
                    backgroundColor: 'rgba(105, 108, 255, 0.2)',
                    tension: 0.4,
                    pointRadius: 4
                }]
            },
            options: getTimeChartOptions()
        });
    } catch (e) {
        console.error('圖表載入失敗', e);
        setChartStatus('trendChartStatus', '讀取趨勢資料失敗，請稍後再試。');
    }
}

function showLoader() { elements.loader.style.display = 'flex'; }
function hideLoader() { elements.loader.style.display = 'none'; }
