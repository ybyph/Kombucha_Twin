const engine = new KombuchaEngineV4();
let chart;
const STORAGE_KEY = 'kombucha-twin-data';

function saveToStorage() {
    const params = {
        'vessel-d': document.getElementById('vessel-d').value,
        'liquid-h': document.getElementById('liquid-h').value,
        'm-water': document.getElementById('m-water').value,
        'm-tea': document.getElementById('m-tea').value,
        'm-sugar': document.getElementById('m-sugar').value,
        'm-starter': document.getElementById('m-starter').value
    };
    
    const data = {
        logs: engine.logs,
        params: params,
        mode: engine.mode,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    
    try {
        const data = JSON.parse(stored);
        
        if (data.params) {
            Object.keys(data.params).forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = data.params[key];
            });
        }
        
        if (data.mode) {
            engine.mode = data.mode;
        }
        
        if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach(log => {
                engine.logs.push({
                    ...log,
                    timestamp: new Date(log.timestamp)
                });
            });
        }
        
        return true;
    } catch (e) {
        console.error('Failed to load from storage:', e);
        return false;
    }
}

function updateUI(params) {
    document.getElementById('theory-brix').innerText = params.theoryBrix;
    
    const teaEl = document.getElementById('tea-status');
    teaEl.innerText = params.teaStatus;
    teaEl.className = params.teaClass;
    
    document.getElementById('starter-pct').innerText = params.starterPct;
    document.getElementById('av-value').innerText = params.avValue;
}

function renderResults(result) {
    document.getElementById('bio-hours').innerText = result.bioHours.toFixed(1) + ' h';
    document.getElementById('tta-est').innerText = result.tta.toFixed(2);
    
    const abvEl = document.getElementById('abv-est');
    abvEl.innerText = result.abv.toFixed(2) + '%';
    abvEl.className = result.abvClass;

    const action = document.getElementById('smart-action');
    action.innerText = result.actionText;
    action.className = result.actionClass;

    const container = document.getElementById('history-container');
    container.innerHTML = '';
    
    if (result.processed.length === 0) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.data.datasets[1].data = [];
        chart.update();
        return;
    }

    [...result.processed].reverse().forEach(p => {
        const d = p.log.timestamp;
        const card = document.createElement('div');
        card.className = "bg-black/60 border border-gray-800 rounded-xl p-3 relative group transition-all hover:border-gray-600";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] mono text-gray-500 uppercase">${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400">T+${p.hoursElapsed.toFixed(1)}h</span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center">
                <div class="col-span-1 border-r border-gray-800">
                    <p class="text-[8px] text-gray-600 uppercase">Temp</p>
                    <p class="text-xs text-white mono">${p.displayTemp}°</p>
                </div>
                <div class="col-span-1 border-r border-gray-800">
                    <p class="text-[8px] text-gray-600 uppercase">Brix</p>
                    <p class="text-xs text-amber-500 mono">${p.log.brix || '-'}</p>
                </div>
                <div class="col-span-1 border-r border-gray-800">
                    <p class="text-[8px] text-gray-600 uppercase">pH</p>
                    <p class="text-xs text-blue-400 mono">${p.log.ph || '-'}</p>
                </div>
                <div class="col-span-1">
                    <p class="text-[8px] text-gray-600 uppercase">ABV%</p>
                    <p class="text-xs text-red-500 mono font-bold">${p.abv.toFixed(2)}</p>
                </div>
            </div>
            <button onclick="deleteEntry(${p.log.id})" class="absolute -top-1 -right-1 w-5 h-5 bg-red-900 text-red-200 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px]">×</button>
        `;
        container.appendChild(card);
    });

    chart.data.labels = result.processed.map(p => `T+${p.hoursElapsed.toFixed(0)}h`);
    chart.data.datasets[0].data = result.processed.map(p => p.realBrix);
    chart.data.datasets[1].data = result.processed.map(p => p.ph);
    chart.update();
}

function deleteEntry(id) {
    const result = engine.deleteRecord(id);
    renderResults(result);
    saveToStorage();
}

function showToast() {
    const t = document.getElementById('toast');
    t.classList.replace('toast-exit', 'toast-enter');
    setTimeout(() => t.classList.replace('toast-enter', 'toast-exit'), 2000);
}

function initChart() {
    const ctx = document.getElementById('roadmap-chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [
                { 
                    label: '真实糖度', 
                    data: [], 
                    borderColor: '#f59e0b', 
                    tension: 0.4, 
                    yAxisID: 'y', 
                    spanGaps: true, 
                    pointRadius: 3, 
                    fill: true, 
                    backgroundColor: 'rgba(245, 158, 11, 0.05)' 
                },
                { 
                    label: 'pH', 
                    data: [], 
                    borderColor: '#3b82f6', 
                    borderDash: [5, 5], 
                    tension: 0.4, 
                    yAxisID: 'y1', 
                    spanGaps: true, 
                    pointRadius: 3 
                }
            ]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#4b5563', font: { size: 9, family: 'monospace' } } 
                },
                y: { 
                    position: 'left', 
                    min: 0, 
                    max: 14, 
                    grid: { color: '#1f2937' }, 
                    ticks: { color: '#f59e0b' } 
                },
                y1: { 
                    position: 'right', 
                    min: 2.5, 
                    max: 5, 
                    grid: { display: false }, 
                    ticks: { color: '#3b82f6' } 
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function initEventListeners() {
    const btnPoint = document.getElementById('mode-point');
    const btnDiurnal = document.getElementById('mode-diurnal');
    
    btnPoint.onclick = () => {
        engine.mode = 'point';
        btnPoint.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-gray-800 text-white transition-all";
        btnDiurnal.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-gray-500 transition-all";
        document.getElementById('box-temp-main').classList.remove('hidden');
        document.getElementById('box-temp-min').classList.add('hidden');
        document.getElementById('box-temp-max').classList.add('hidden');
    };

    btnDiurnal.onclick = () => {
        engine.mode = 'diurnal';
        btnDiurnal.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-gray-800 text-white transition-all";
        btnPoint.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-gray-500 transition-all";
        document.getElementById('box-temp-main').classList.add('hidden');
        document.getElementById('box-temp-min').classList.remove('hidden');
        document.getElementById('box-temp-max').classList.remove('hidden');
    };

    document.getElementById('btn-submit').onclick = () => {
        const data = {
            time: document.getElementById('input-time').value,
            mode: engine.mode,
            temp: parseFloat(document.getElementById('input-temp').value),
            tempMin: parseFloat(document.getElementById('input-temp-min').value),
            tempMax: parseFloat(document.getElementById('input-temp-max').value),
            brix: document.getElementById('input-brix').value,
            ph: document.getElementById('input-ph').value
        };
        if (!data.time || (engine.mode === 'point' && isNaN(data.temp)) || (engine.mode === 'diurnal' && (isNaN(data.tempMin) || isNaN(data.tempMax)))) {
            alert("必填项未录入（时间与温度）"); return;
        }
        const params = engine.initParams();
        updateUI(params);
        const result = engine.addRecord(data);
        renderResults(result);
        saveToStorage();
        showToast();
    };

    ['vessel-d', 'liquid-h', 'm-water', 'm-tea', 'm-sugar', 'm-starter'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const params = engine.initParams();
            updateUI(params);
            const result = engine.calculate();
            renderResults(result);
            saveToStorage();
        });
    });
}

function initPresetData() {
    const now = new Date();
    const d1 = new Date(now - 172800000);
    engine.addRecord({ 
        time: d1.toISOString().slice(0,16), 
        mode: 'diurnal', 
        tempMin: 22, 
        tempMax: 27, 
        brix: '12', 
        ph: '4.5' 
    });
    engine.addRecord({ 
        time: now.toISOString().slice(0,16), 
        mode: 'point', 
        temp: 25.5, 
        brix: '10.5', 
        ph: '3.9' 
    });
}

window.onload = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('input-time').value = now.toISOString().slice(0, 16);
    
    initChart();
    initEventListeners();
    
    const loaded = loadFromStorage();
    
    const params = engine.initParams();
    updateUI(params);
    
    if (!loaded) {
        initPresetData();
    } else {
        const btnPoint = document.getElementById('mode-point');
        const btnDiurnal = document.getElementById('mode-diurnal');
        
        if (engine.mode === 'point') {
            btnPoint.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-gray-800 text-white transition-all";
            btnDiurnal.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-gray-500 transition-all";
            document.getElementById('box-temp-main').classList.remove('hidden');
            document.getElementById('box-temp-min').classList.add('hidden');
            document.getElementById('box-temp-max').classList.add('hidden');
        } else {
            btnDiurnal.className = "flex-1 py-1 text-[10px] font-bold rounded-md bg-gray-800 text-white transition-all";
            btnPoint.className = "flex-1 py-1 text-[10px] font-bold rounded-md text-gray-500 transition-all";
            document.getElementById('box-temp-main').classList.add('hidden');
            document.getElementById('box-temp-min').classList.remove('hidden');
            document.getElementById('box-temp-max').classList.remove('hidden');
        }
    }
    
    const result = engine.calculate();
    renderResults(result);
};