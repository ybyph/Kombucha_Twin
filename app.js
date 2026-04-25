const engine = new KombuchaEngineV4();
let chart;
const STORAGE_KEY = 'kombucha-twin-data';

window.f2Activated = false;
window.f1Locked = false;

function safeSetText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function saveToStorage() {
    try {
        const data = {
            logs: engine.logs,
            mode: engine.mode,
            f2Activated: window.f2Activated,
            f1Locked: window.f1Locked,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('saveToStorage error:', e);
    }
}

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;

        const data = JSON.parse(stored);

        if (data.mode) engine.mode = data.mode;
        if (data.f2Activated) window.f2Activated = data.f2Activated;
        if (data.f1Locked) window.f1Locked = data.f1Locked;

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
        console.error('loadFromStorage error:', e);
        return false;
    }
}

function updateTheoryBrix() {
    try {
        const water = parseFloat(document.getElementById('m-water').value) || 0;
        const sugar = parseFloat(document.getElementById('m-sugar').value) || 0;
        const theoryBrix = water > 0 ? ((sugar / water) * 100).toFixed(1) : "0.0";
        const display = document.getElementById('theory-brix');
        if (display) display.innerText = theoryBrix;
    } catch (e) {
        console.error('updateTheoryBrix error:', e);
    }
}

function updateUI(params) {
    try {
        if (!params) return;
        const brixEl = document.getElementById('theory-brix');
        if (brixEl) { brixEl.innerText = params.theoryBrix; brixEl.className = params.brixClass || 'text-amber-400'; }

        const teaEl = document.getElementById('tea-status');
        if (teaEl) { teaEl.innerText = params.teaStatus; teaEl.className = params.teaClass || 'text-green-400'; }

        const starterEl = document.getElementById('starter-pct');
        if (starterEl) { starterEl.innerText = params.starterPct; starterEl.className = params.starterClass || 'text-blue-400'; }

        const avEl = document.getElementById('av-value');
        if (avEl) avEl.innerText = params.avValue;
    } catch (e) {
        console.error('updateUI error:', e);
    }
}

function clearInputFields() {
    try {
        document.getElementById('input-temp').value = '';
        document.getElementById('input-temp-min').value = '';
        document.getElementById('input-temp-max').value = '';
        document.getElementById('input-brix').value = '';
        document.getElementById('input-ph').value = '';
    } catch (e) {
        console.error('clearInputFields error:', e);
    }
}

function showToast(msg = '记录已保存') {
    try {
        const t = document.getElementById('toast');
        if (t) {
            document.getElementById('toast-msg').innerText = msg;
            t.classList.replace('toast-exit', 'toast-enter');
            setTimeout(() => t.classList.replace('toast-enter', 'toast-exit'), 2000);
        }
    } catch (e) {
        console.error('showToast error:', e);
    }
}

function updateDynamicHint() {
    try {
        const hintEl = document.getElementById('first-record-hint');
        if (!hintEl) return;
        if (engine.logs.length === 0) {
            hintEl.classList.remove('hidden');
        } else {
            hintEl.classList.add('hidden');
        }
    } catch (e) {
        console.error('updateDynamicHint error:', e);
    }
}

function recomputeAndRender() {
    try {
        const result = engine.calculate();
        renderResults(result);
        updateDashboard(result);
        saveToStorage();
    } catch (e) {
        console.error('recomputeAndRender error:', e);
    }
}

function updateDashboard(result) {
    try {
        const safe = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        if (!result || engine.logs.length === 0) {
            safe('elapsed-time', '等待首条录入...');
            safe('remaining-time', '0');
            safe('current-brix', '--');
            safe('bio-hours', '0.0 h');
            safe('tta-est', '0.00');
            safe('abv-est', '0.00%');
            safe('smart-action', '环境就绪，等待发酵');
            safe('f1-prediction-text', '等待首条数据录入...');
            return;
        }

        const firstLog = engine.logs[0];
        if (!firstLog || !firstLog.timestamp) {
            safe('elapsed-time', '等待首条录入...');
            safe('remaining-time', '0');
            return;
        }

        const now = new Date();
        const elapsedMs = now - firstLog.timestamp;
        if (!isFinite(elapsedMs) || elapsedMs < 0) {
            safe('elapsed-time', '0 分钟');
        } else {
            const days = Math.floor(elapsedMs / 86400000);
            const hours = Math.floor((elapsedMs % 86400000) / 3600000);
            const minutes = Math.floor((elapsedMs % 3600000) / 60000);
            if (days > 0) {
                safe('elapsed-time', `第 ${days} 天 ${hours} 小时 ${minutes} 分钟`);
            } else if (hours > 0) {
                safe('elapsed-time', `${hours} 小时 ${minutes} 分钟`);
            } else {
                safe('elapsed-time', `${minutes} 分钟`);
            }
        }

        const bioH = (result && isFinite(result.bioHours)) ? result.bioHours : 0;
        safe('bio-hours', bioH.toFixed(1) + ' h');

        const tta = (result && isFinite(result.tta)) ? result.tta : 0;
        safe('tta-est', tta.toFixed(2));

        let abv = 0;
        try {
            const logs = engine.logs;
            const startBrix = (logs[0] && logs[0].brix !== null && isFinite(logs[0].brix)) ? logs[0].brix : 0;
            const lastBrix = (logs[logs.length - 1] && logs[logs.length - 1].brix !== null && isFinite(logs[logs.length - 1].brix)) ? logs[logs.length - 1].brix : 0;
            if (startBrix > 0 && lastBrix > 0) {
                abv = Math.max(0, (startBrix - lastBrix) * 0.5);
            }
            if (isNaN(abv) || !isFinite(abv)) abv = 0;
        } catch (e) {
            abv = 0;
        }
        safe('abv-est', abv.toFixed(2) + '%');

        if (result && result.processed && result.processed.length > 0) {
            const latest = result.processed[result.processed.length - 1];
            const cb = (latest && isFinite(latest.realBrix)) ? latest.realBrix : 0;
            safe('current-brix', cb.toFixed(1));
        }

        let remH = 0;
        if (result && result.remainingHours !== undefined && isFinite(result.remainingHours) && result.remainingHours > 0) {
            remH = result.remainingHours;
        }
        if (remH > 0) {
            const remDays = Math.floor(remH / 24);
            const remHours = Math.floor(remH % 24);
            const remMins = Math.floor((remH % 1) * 60);
            if (remDays > 0) {
                safe('remaining-time', `${remDays}天${remHours}h${remMins}m`);
            } else if (remHours > 0) {
                safe('remaining-time', `${remHours}h${remMins}m`);
            } else {
                safe('remaining-time', `${remMins}m`);
            }
        } else {
            safe('remaining-time', '0');
        }

        const action = document.getElementById('smart-action');
        if (action && result) {
            action.innerText = result.actionText || '环境就绪，等待发酵';
            action.className = result.actionClass || 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30';
        }
    } catch (e) {
        console.error('updateDashboard error:', e);
        safeSetText('elapsed-time', '0');
        safeSetText('remaining-time', '0');
        safeSetText('current-brix', '--');
        safeSetText('abv-est', '0.00%');
    }
}

function initChart() {
    try {
        if (chart) {
            chart.destroy();
            chart = null;
        }

        const ctx = document.getElementById('roadmap-chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '实测糖度',
                        data: [],
                        borderColor: '#f59e0b',
                        tension: 0.4,
                        yAxisID: 'y',
                        spanGaps: true,
                        pointRadius: 4,
                        pointBackgroundColor: '#f59e0b',
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
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6'
                    },
                    {
                        label: '预测糖度',
                        data: [],
                        borderColor: '#10b981',
                        borderDash: [10, 5],
                        tension: 0.6,
                        yAxisID: 'y',
                        spanGaps: true,
                        pointRadius: 0,
                        fill: false,
                        backgroundColor: 'transparent'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#4b5563', font: { size: 9, family: 'monospace' } } },
                    y: { position: 'left', min: 0, max: 14, grid: { color: '#1f2937' }, ticks: { color: '#f59e0b' } },
                    y1: { position: 'right', min: 2.5, max: 5, grid: { display: false }, ticks: { color: '#3b82f6' } }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: { color: '#6b7280', font: { size: 10, family: 'monospace' }, usePointStyle: true, padding: 20 }
                    }
                }
            }
        });
    } catch (e) {
        console.error('initChart error:', e);
    }
}

function renderResults(result) {
    try {
        if (!chart) {
            initChart();
            if (!chart) return;
        }

        const container = document.getElementById('history-container');
        if (container) container.innerHTML = '';

        if (!result || !result.processed || result.processed.length === 0) {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.data.datasets[1].data = [];
            chart.data.datasets[2].data = [];
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
                        <p class="text-xs text-amber-500 mono">${p.log.brix !== null ? p.log.brix : '-'}</p>
                    </div>
                    <div class="col-span-1 border-r border-gray-800">
                        <p class="text-[8px] text-gray-600 uppercase">pH</p>
                        <p class="text-xs text-blue-400 mono">${p.log.ph !== null ? p.log.ph : '-'}</p>
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

        const actualData = result.processed.map(p => isFinite(p.realBrix) ? p.realBrix : null);
        const phData = result.processed.map(p => isFinite(p.ph) ? p.ph : null);
        const hoursElapsed = result.processed.map(p => p.hoursElapsed);

        let predictLabels = [];
        let predictData = [];
        if (result.predictions && result.predictions.length > 0) {
            const lastHour = result.processed[result.processed.length - 1].hoursElapsed;
            result.predictions.forEach(pred => {
                predictLabels.push(lastHour + pred.hours);
                predictData.push(isFinite(pred.brix) ? pred.brix : null);
            });
        }

        const lastHour = result.processed.length > 0 ? result.processed[result.processed.length - 1].hoursElapsed : 0;
        const maxDataHour = predictLabels.length > 0 ? Math.max(lastHour, ...predictLabels) : lastHour;
        const step = maxDataHour > 48 ? 24 : 12;
        const numSteps = Math.ceil(maxDataHour / step) + 1;

        const axisLabels = [];
        const alignedActualData = [];
        const alignedPhData = [];
        const alignedPredictData = [];

        for (let i = 0; i <= numSteps; i++) {
            const hour = i * step;
            axisLabels.push(`T+${hour}h`);

            let actualVal = null;
            let actualPh = null;
            for (let j = 0; j < hoursElapsed.length; j++) {
                if (Math.abs(hoursElapsed[j] - hour) < step * 0.6) {
                    actualVal = actualData[j];
                    actualPh = phData[j];
                    break;
                }
            }
            alignedActualData.push(actualVal);
            alignedPhData.push(actualPh);

            let predictVal = null;
            if (hour > lastHour && predictLabels.length > 1) {
                for (let j = 0; j < predictLabels.length - 1; j++) {
                    if (hour >= predictLabels[j] && hour <= predictLabels[j + 1]) {
                        const ratio = (predictLabels[j + 1] - predictLabels[j]) > 0 ? (hour - predictLabels[j]) / (predictLabels[j + 1] - predictLabels[j]) : 0;
                        predictVal = predictData[j] + (predictData[j + 1] - predictData[j]) * ratio;
                        break;
                    }
                }
            }
            alignedPredictData.push(predictVal);
        }

        chart.data.labels = axisLabels;
        chart.data.datasets[0].data = alignedActualData;
        chart.data.datasets[1].data = alignedPhData;
        chart.data.datasets[2].data = alignedPredictData;
        chart.update();
    } catch (e) {
        console.error('renderResults error:', e);
    }
}

function deleteEntry(id) {
    if (window.f1Locked) return;
    try {
        engine.deleteRecord(id);
        updateDynamicHint();
        recomputeAndRender();
    } catch (e) {
        console.error('deleteEntry error:', e);
    }
}

function autoCalculate() {
    try {
        const water = 1000;
        const tea = 10;
        const sugar = 100;
        const starter = 100;

        document.getElementById('m-water').value = water;
        document.getElementById('m-tea').value = tea;
        document.getElementById('m-sugar').value = sugar;
        document.getElementById('m-starter').value = starter;

        updateTheoryBrix();

        const params = engine.initParams();
        updateUI(params);
        recomputeAndRender();
        showToast('配方已应用');
    } catch (e) {
        console.error('autoCalculate error:', e);
    }
}

function startNewBatch() {
    try {
        if (confirm('确定要开始新批次吗？这将清空所有历史记录和配置。')) {
            localStorage.clear();
            window.f2Activated = false;
            window.f1Locked = false;
            engine.logs = [];
            engine.mode = 'point';

            document.getElementById('m-water').value = '1000';
            document.getElementById('m-tea').value = '10';
            document.getElementById('m-sugar').value = '100';
            document.getElementById('m-starter').value = '100';
            document.getElementById('vessel-d').value = '0';
            document.getElementById('liquid-h').value = '0';
            document.getElementById('base-amount').value = '0';
            document.getElementById('input-temp').value = '';
            document.getElementById('input-temp-min').value = '';
            document.getElementById('input-temp-max').value = '';
            document.getElementById('input-brix').value = '';
            document.getElementById('input-ph').value = '';

            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'flex';
            const endBtn = document.getElementById('btn-end-f1');
            if (endBtn) endBtn.style.display = 'block';
            const lockedHint = document.getElementById('f1-locked-hint');
            if (lockedHint) lockedHint.classList.add('hidden');

            updateTheoryBrix();
            const params = engine.initParams();
            updateUI(params);

            safeSetText('elapsed-time', '等待首条录入...');
            safeSetText('remaining-time', '0');
            safeSetText('current-brix', '--');
            safeSetText('bio-hours', '0.0 h');
            safeSetText('tta-est', '0.00');
            safeSetText('abv-est', '0.00%');
            safeSetText('smart-action', '环境就绪，等待发酵');
            safeSetText('f1-prediction-text', '等待首条数据录入...');

            const hc = document.getElementById('history-container');
            if (hc) hc.innerHTML = '';

            if (chart) { chart.destroy(); chart = null; }
            initChart();
            updateDynamicHint();

            showToast('新批次已开始');
        }
    } catch (e) {
        console.error('startNewBatch error:', e);
    }
}

function toggleRecipePanel() {
    try {
        const content = document.getElementById('recipe-content');
        const toggleBtn = document.getElementById('toggle-recipe');
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            toggleBtn.innerText = '折叠';
        } else {
            content.classList.add('hidden');
            toggleBtn.innerText = '展开';
        }
    } catch (e) {
        console.error('toggleRecipePanel error:', e);
    }
}

function validateForm(engineMode) {
    try {
        const selectedTime = document.getElementById('input-time').value;
        if (!selectedTime) { alert("请选择时间"); return false; }

        const selectedDate = new Date(selectedTime);
        const now = new Date();
        if (selectedDate > now) { alert("时间不能晚于当前系统时间"); return false; }

        const existingTimestamps = engine.logs.map(l => l.timestamp.getTime());
        const newTimestamp = selectedDate.getTime();
        if (existingTimestamps.includes(newTimestamp)) { alert("该时间点已有记录"); return false; }

        if (engineMode === 'diurnal') {
            const tempMin = document.getElementById('input-temp-min').value;
            const tempMax = document.getElementById('input-temp-max').value;
            if (tempMin === '' || tempMax === '') { alert("昼夜模式必须填写最低温和最高温"); return false; }
        } else {
            const temp = document.getElementById('input-temp').value;
            if (temp === '' || isNaN(parseFloat(temp))) { alert("请输入温度"); return false; }
        }

        return true;
    } catch (e) {
        console.error('validateForm error:', e);
        return false;
    }
}

function initEventListeners() {
    const btnAutoCalc = document.getElementById('btn-auto-calc');
    if (btnAutoCalc) {
        btnAutoCalc.addEventListener('click', () => {
            const factor = document.getElementById('limiting-factor').value;
            const baseAmount = parseFloat(document.getElementById('base-amount').value) || 0;
            let water, tea, sugar, starter;

            if (factor === 'starter') {
                starter = baseAmount;
                water = baseAmount * 10;
            } else {
                water = baseAmount;
                starter = baseAmount * 0.1;
            }
            tea = water * 0.01;
            sugar = water * 0.1;

            document.getElementById('m-water').value = Math.round(water);
            document.getElementById('m-tea').value = Math.round(tea);
            document.getElementById('m-sugar').value = Math.round(sugar);
            document.getElementById('m-starter').value = Math.round(starter);

            if (typeof updateTheoryBrix === 'function') updateTheoryBrix();
            alert("配方已应用：纯水 " + Math.round(water) + "g");
        });
    }

    document.getElementById('btn-new-batch').onclick = startNewBatch;
    document.getElementById('btn-new-batch-footer').onclick = startNewBatch;
    document.getElementById('toggle-recipe').onclick = toggleRecipePanel;

    const endF1Btn = document.getElementById('btn-end-f1');
    if (endF1Btn) {
        endF1Btn.addEventListener('click', () => {
            if (window.f1Locked) return;

            if (engine.logs.length === 0) {
                alert("请至少录入一条日志数据后再结束一发");
                return;
            }

            const lastLog = engine.logs[engine.logs.length - 1];
            if (!lastLog) {
                alert("请至少录入一条日志数据后再结束一发");
                return;
            }

            window.f1Locked = true;
            window.f2Activated = true;

            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'none';

            const bottlingBrixEl = document.getElementById('f2-bottling-brix');
            if (bottlingBrixEl && lastLog.brix !== null) {
                bottlingBrixEl.value = lastLog.brix.toFixed(1);
            }

            const bottlingPhEl = document.getElementById('f2-bottling-ph');
            if (bottlingPhEl && lastLog.ph !== null) {
                bottlingPhEl.value = lastLog.ph.toFixed(1);
            }

            const countdownBtn = document.getElementById('f2-start-countdown-btn');
            if (countdownBtn) countdownBtn.classList.remove('hidden');

            const endBtn = document.getElementById('btn-end-f1');
            if (endBtn) endBtn.style.display = 'none';
            const lockedHint = document.getElementById('f1-locked-hint');
            if (lockedHint) lockedHint.classList.remove('hidden');

            saveToStorage();
            showToast('一发已结束，数据已同步至二发！');

            const f2Panel = document.getElementById('f2-panel');
            if (f2Panel) {
                window.scrollTo(0, f2Panel.offsetTop);
            }
        });
    }

    document.getElementById('f2-start-countdown-btn').onclick = () => {
        if (!window.f2Activated) return;
        const fruitWeight = parseFloat(document.getElementById('f2-fruit-weight').value) || 0;
        const extraSugar = parseFloat(document.getElementById('f2-extra-sugar').value) || 0;
        if (fruitWeight === 0 && extraSugar === 0) {
            alert('请至少输入水果重量或补糖量');
            return;
        }
        showToast('🍾 F2 二发已启动！');
    };

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
        if (window.f1Locked) return;

        if (engine.logs.length === 0) {
            const brix = document.getElementById('input-brix').value;
            const ph = document.getElementById('input-ph').value;
            if (brix === '' || ph === '') {
                alert("首条记录必须填写初始 Brix 和 pH");
                return;
            }
        }

        if (!validateForm(engine.mode)) return;

        const data = {
            time: document.getElementById('input-time').value,
            mode: engine.mode,
            temp: parseFloat(document.getElementById('input-temp').value) || 0,
            tempMin: parseFloat(document.getElementById('input-temp-min').value) || 0,
            tempMax: parseFloat(document.getElementById('input-temp-max').value) || 0,
            brix: document.getElementById('input-brix').value,
            ph: document.getElementById('input-ph').value
        };

        engine.addRecord(data);
        clearInputFields();
        updateDynamicHint();
        recomputeAndRender();
        showToast();
    };

    ['vessel-d', 'liquid-h', 'm-water', 'm-tea', 'm-sugar', 'm-starter'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            try {
                updateTheoryBrix();
                const params = engine.initParams();
                updateUI(params);
                recomputeAndRender();
            } catch (e) {
                console.error('param input error:', e);
            }
        });
    });

    ['f2-bottle-volume', 'f2-fill-slider', 'f2-fruit-type', 'f2-additive-light', 'f2-additive-heavy', 'f2-fruit-weight', 'f2-extra-sugar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                try {
                    const fillSlider = document.getElementById('f2-fill-slider');
                    if (fillSlider) {
                        document.getElementById('f2-fill-percent').innerText = fillSlider.value + '%';
                    }
                } catch (e) {
                    console.error('f2 input error:', e);
                }
            });
        }
    });

    document.getElementById('f2-start-chill').addEventListener('click', () => {
        if (!window.f2Activated) return;
        showToast('冷藏模式已启动');
    });

    document.getElementById('f2-suggest-btn').addEventListener('click', () => {
        if (!window.f2Activated) return;
        try {
            const bottleVolume = parseFloat(document.getElementById('f2-bottle-volume').value) || 1000;
            const fillPercent = parseFloat(document.getElementById('f2-fill-slider').value) || 90;
            const liquidVolume = bottleVolume * (fillPercent / 100);
            const ratio = liquidVolume / 1000;
            document.getElementById('f2-fruit-weight').value = Math.round(50 * ratio);
            document.getElementById('f2-extra-sugar').value = Math.round(3 * ratio);
            showToast('已应用推荐配方');
        } catch (e) {
            console.error('f2-suggest-btn error:', e);
        }
    });
}

window.onload = () => {
    try {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('input-time').value = now.toISOString().slice(0, 16);

        initChart();
        initEventListeners();
        updateDynamicHint();

        loadFromStorage();

        updateTheoryBrix();
        const params = engine.initParams();
        updateUI(params);

        if (engine.mode === 'diurnal') {
            document.getElementById('btn-diurnal').click();
        }

        recomputeAndRender();

        if (window.f2Activated) {
            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'none';
            const endBtn = document.getElementById('btn-end-f1');
            if (endBtn) endBtn.style.display = 'none';
            const lockedHint = document.getElementById('f1-locked-hint');
            if (lockedHint) lockedHint.classList.remove('hidden');
        } else {
            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'flex';
            const endBtn = document.getElementById('btn-end-f1');
            if (endBtn) endBtn.style.display = 'block';
        }

        setInterval(() => {
            if (engine.logs.length > 0) {
                recomputeAndRender();
            }
        }, 60000);
    } catch (e) {
        console.error('window.onload error:', e);
    }
};
