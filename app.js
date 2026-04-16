const API_URL = './data.json';
const elements = {
    rankingBody: document.getElementById('rankingBody'),
    totalWorks: document.getElementById('total-works'),
    updateTime: document.getElementById('update-time'),
    searchInput: document.getElementById('searchInput'),
    refreshBtn: document.getElementById('refreshBtn'),
    groupFilter: document.getElementById('groupFilter'),
    loader: document.getElementById('loader'),
    errorMsg: document.getElementById('error-msg'),
    useMockDataBtn: document.getElementById('useMockData')
};

let allData = [];

async function fetchData() {
    showLoader();
    hideError();

    try {
        const response = await fetch(API_URL);

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        processAndRender(data);
    } catch (error) {
        console.error('Fetch error:', error);
        showError();
    } finally {
        hideLoader();
    }
}

function processAndRender(data) {
    if (!Array.isArray(data)) return;

    // 按票數排序 (填補空票數為 0，並確保是數字)
    allData = data.sort((a, b) => {
        const countA = parseInt(a.vote_count) || 0;
        const countB = parseInt(b.vote_count) || 0;
        return countB - countA;
    });

    // 動態生成組別選項
    const uniqueGroups = [...new Set(allData.map(item => item.rgroup))].sort();
    elements.groupFilter.innerHTML = '<option value="all">所有組別</option>' + 
        uniqueGroups.map(g => `<option value="${g}">${g}</option>`).join('');

    elements.updateTime.innerText = new Date().toLocaleTimeString();
    applyFilters();
}

function applyFilters() {
    const term = elements.searchInput.value.toLowerCase();
    const selectedGroup = elements.groupFilter.value;

    const filtered = allData.filter(item => {
        const matchesSearch = item.rtitle.toLowerCase().includes(term) || 
                             item.resultid.toLowerCase().includes(term);
        const matchesGroup = selectedGroup === 'all' || item.rgroup === selectedGroup;
        return matchesSearch && matchesGroup;
    });

    elements.totalWorks.innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(dataToRender) {
    elements.rankingBody.innerHTML = '';

    dataToRender.forEach((item, index) => {
        const rank = index + 1;
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>
                <div class="rank-badge">${rank}</div>
            </td>
            <td>
                <div class="work-info">
                    <span class="work-title">${item.rtitle}</span>
                    <span class="work-id"># ${item.resultid}</span>
                </div>
            </td>
            <td class="group-col">
                <span class="group-tag">${item.rgroup}</span>
            </td>
            <td class="vote-col">
                <span class="vote-count">${item.vote_count}</span>
                <small style="color: var(--text-muted); font-size: 0.7rem;"> 票</small>
            </td>
            <td class="action-col">
                <button class="btn-detail" onclick="window.open('https://sciexplore2026.colife.org.tw/work/detail.php?id=${item.resultid}', '_blank')">
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </td>
        `;

        elements.rankingBody.appendChild(tr);
    });
}

function updateStats() {
    elements.totalWorks.innerText = allData.length;
    elements.updateTime.innerText = new Date().toLocaleTimeString();
}

function showLoader() { elements.loader.style.display = 'flex'; }
function hideLoader() { elements.loader.style.display = 'none'; }
function showError() { elements.errorMsg.style.display = 'flex'; }
function hideError() { elements.errorMsg.style.display = 'none'; }

// 搜尋與篩選事件
elements.searchInput.addEventListener('input', applyFilters);
elements.groupFilter.addEventListener('change', applyFilters);

// 重整按鈕
elements.refreshBtn.addEventListener('click', fetchData);

// 模擬資料 (給被 CORS 擋住的情況預覽)
elements.useMockDataBtn.addEventListener('click', () => {
    const mockData = [
        { resultid: 'E001', rgroup: '國小組', rtitle: '為什麼可樂會噴出來', vote_count: '1250' },
        { resultid: 'J002', rgroup: '國中組', rtitle: '校園植物的多樣性研究', vote_count: '3420' },
        { resultid: 'G003', rgroup: '普高組', rtitle: '人工智慧在農業的應用', vote_count: '2100' },
        { resultid: 'T004', rgroup: '教師組', rtitle: '科學探究教學法初探', vote_count: '800' },
        { resultid: 'S005', rgroup: '大專組', rtitle: '量子糾纏與加密通訊', vote_count: '4500' }
    ];
    hideError();
    processAndRender(mockData);
});

// 初始化
window.onload = fetchData;
