const engine = new KombuchaEngineV4();
let chart;
const STORAGE_KEY = 'kombucha-twin-data';

const FRUIT_SUGAR_RATIO = {
    'very-low': 0.015,
    'low': 0.05,
    'medium': 0.10,
    'high': 0.15,
    'pure': 1.0
};

window.f2Activated = false;
window.f1Locked = false;
window.chillModeActive = false;
window.chillEndTime = null;
window.chillTimerInterval = null;
window.f2TargetTime = null;
window.f2CountdownInterval = null;
window.f2CountdownStarted = false;

function safeSetText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function saveToStorage() {
    try {
        const params = {
            'vessel-d': document.getElementById('vessel-d').value,
            'liquid-h': document.getElementById('liquid-h').value,
            'm-water': document.getElementById('m-water').value,
            'm-tea': document.getElementById('m-tea').value,
            'm-sugar': document.getElementById('m-sugar').value,
            'm-starter': document.getElementById('m-starter').value
        };

        const f2Data = {
            'bottling-brix': document.getElementById('f2-bottling-brix').value,
            'bottling-ph': document.getElementById('f2-bottling-ph').value,
            'bottle-volume': document.getElementById('f2-bottle-volume').value,
            'fill-slider': document.getElementById('f2-fill-slider').value,
            'fruit-type': document.getElementById('f2-fruit-type').value,
            'fruit-weight': document.getElementById('f2-fruit-weight').value,
            'extra-sugar': document.getElementById('f2-extra-sugar').value,
            'additive-light': document.getElementById('f2-additive-light')?.checked || false,
            'additive-heavy': document.getElementById('f2-additive-heavy')?.checked || false
        };

        const data = {
            logs: engine.logs,
            params: params,
            f2Data: f2Data,
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

        if (data.params) {
            Object.keys(data.params).forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = data.params[key];
            });
        }

        if (data.f2Data) {
            const f2Map = {
                'bottling-brix': 'f2-bottling-brix',
                'bottling-ph': 'f2-bottling-ph',
                'bottle-volume': 'f2-bottle-volume',
                'fill-slider': 'f2-fill-slider',
                'fruit-type': 'f2-fruit-type',
                'fruit-weight': 'f2-fruit-weight',
                'extra-sugar': 'f2-extra-sugar'
            };
            Object.keys(f2Map).forEach(key => {
                const el = document.getElementById(f2Map[key]);
                if (el) el.value = data.f2Data[key];
            });

            if (document.getElementById('f2-additive-light')) {
                document.getElementById('f2-additive-light').checked = data.f2Data['additive-light'] || false;
            }
            if (document.getElementById('f2-additive-heavy')) {
                document.getElementById('f2-additive-heavy').checked = data.f2Data['additive-heavy'] || false;
            }

            document.getElementById('f2-fill-percent').innerText = data.f2Data['fill-slider'] + '%';
        }

        if (data.mode) {
            engine.mode = data.mode;
        }

        if (data.f2Activated) {
            window.f2Activated = data.f2Activated;
        }
        if (data.f1Locked) {
            window.f1Locked = data.f1Locked;
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

        if (!result || !engine.logs || engine.logs.length === 0) {
            safe('elapsed-time', '等待首条录入...');
            safe('remaining-time', '0');
            safe('current-brix', '--');
            safe('bio-hours', '0.0 h');
            safe('tta-est', '0.00');
            safe('abv-est', '0.00%');
            const abvEl = document.getElementById('abv-est');
            if (abvEl) abvEl.className = 'text-3xl mono font-black text-red-500';
            safe('smart-action', '环境就绪，等待发酵');
            const action = document.getElementById('smart-action');
            if (action) action.className = 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30';
            safe('f1-prediction-text', '等待首条数据录入...');
            const cal1 = document.getElementById('add-to-calendar-f1');
            if (cal1) cal1.classList.add('hidden');
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
            const logs = engine.logs || [];
            const firstBrix = (logs[0] && logs[0].brix !== null && logs[0].brix !== undefined && isFinite(logs[0].brix)) ? logs[0].brix : 0;
            const lastIdx = logs.length - 1;
            const lastBrix = (logs[lastIdx] && logs[lastIdx].brix !== null && logs[lastIdx].brix !== undefined && isFinite(logs[lastIdx].brix)) ? logs[lastIdx].brix : 0;

            if (firstBrix === 0 || lastBrix === 0) {
                abv = 0;
            } else {
                abv = (firstBrix - lastBrix) * 0.5;
            }
            if (abv < 0 || isNaN(abv) || !isFinite(abv)) {
                abv = 0;
            }
        } catch (e) {
            console.error('ABV calculation error:', e);
            abv = 0;
        }
        safe('abv-est', abv.toFixed(2) + '%');
        const abvEl = document.getElementById('abv-est');
        if (abvEl) abvEl.className = 'text-3xl mono font-black text-red-500';

        const action = document.getElementById('smart-action');
        if (action) {
            action.innerText = (result && result.actionText) ? result.actionText : '环境就绪，等待发酵';
            action.className = (result && result.actionClass) ? result.actionClass : 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30';
        }

        if (result && result.processed && result.processed.length > 0) {
            const latest = result.processed[result.processed.length - 1];
            const cb = (latest && isFinite(latest.realBrix)) ? latest.realBrix : 0;
            safe('current-brix', cb.toFixed(1));
        } else {
            const lastLog = engine.logs[engine.logs.length - 1];
            if (lastLog && lastLog.brix !== null && lastLog.brix !== undefined && isFinite(lastLog.brix)) {
                safe('current-brix', lastLog.brix.toFixed(1));
            }
        }

        let remH = 0;
        try {
            if (result && result.remainingHours !== undefined && isFinite(result.remainingHours) && result.remainingHours > 0) {
                remH = result.remainingHours;
            }
        } catch (e) {
            remH = 0;
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
    } catch (e) {
        console.error('updateDashboard error:', e);
        const safe = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        safe('elapsed-time', '0');
        safe('remaining-time', '0');
        safe('current-brix', '--');
        safe('bio-hours', '0.0 h');
        safe('tta-est', '0.00');
        safe('abv-est', '0.00%');
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
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#6b7280',
                            font: { size: 10, family: 'monospace' },
                            usePointStyle: true,
                            padding: 20
                        }
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
            result.predictions.forEach((pred) => {
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

function calculateF2Pressure() {
    try {
        if (!window.f2Activated) return;

        const bottleVolume = parseFloat(document.getElementById('f2-bottle-volume').value) || 1000;
        const fillPercent = parseFloat(document.getElementById('f2-fill-slider').value) || 90;
        const fruitType = document.getElementById('f2-fruit-type').value;
        let fruitWeight = parseFloat(document.getElementById('f2-fruit-weight').value) || 0;
        let extraSugar = parseFloat(document.getElementById('f2-extra-sugar').value) || 0;

        const liquidVolume = bottleVolume * (fillPercent / 100);
        const liquidWeight = liquidVolume;
        safeSetText('f2-liquid-weight', liquidWeight.toFixed(0) + ' g');

        const maxFruitWeight = liquidWeight * 0.5;
        const fruitInput = document.getElementById('f2-fruit-weight');
        const fruitHint = document.getElementById('f2-fruit-hint');

        if (fruitWeight > maxFruitWeight) {
            fruitWeight = maxFruitWeight;
            document.getElementById('f2-fruit-weight').value = maxFruitWeight;
            fruitInput.style.backgroundColor = '#374151';
            fruitInput.style.borderColor = '#ef4444';
            if (fruitHint) { fruitHint.textContent = '已自动重置为上限值 (最大 ' + maxFruitWeight.toFixed(0) + 'g)'; fruitHint.style.color = '#ef4444'; }
        } else {
            fruitInput.style.backgroundColor = '';
            fruitInput.style.borderColor = '';
            if (fruitHint) fruitHint.textContent = '';
        }

        const fruitRatioEl = document.getElementById('f2-fruit-ratio');
        if (fruitRatioEl) fruitRatioEl.textContent = fruitWeight > 0 ? ((fruitWeight / liquidWeight) * 100).toFixed(1) + '%' : '0.0%';

        const maxExtraSugar = 100;
        const sugarInput = document.getElementById('f2-extra-sugar');
        const sugarHint = document.getElementById('f2-sugar-hint');

        if (extraSugar > maxExtraSugar) {
            extraSugar = maxExtraSugar;
            document.getElementById('f2-extra-sugar').value = maxExtraSugar;
            sugarInput.style.backgroundColor = '#374151';
            sugarInput.style.borderColor = '#ef4444';
            if (sugarHint) { sugarHint.textContent = '已自动重置为上限值 (最大 100g)'; sugarHint.style.color = '#ef4444'; sugarHint.classList.remove('hidden'); }
        } else {
            sugarInput.style.backgroundColor = '';
            sugarInput.style.borderColor = '';
            if (sugarHint) { sugarHint.textContent = ''; sugarHint.classList.add('hidden'); }
        }

        const sugarRatioEl = document.getElementById('f2-sugar-ratio');
        if (sugarRatioEl) sugarRatioEl.textContent = extraSugar > 0 ? ((extraSugar / liquidWeight) * 100).toFixed(1) + '%' : '0.0%';

        const fruitSugarRatio = FRUIT_SUGAR_RATIO[fruitType] || 0;

        const bottlingBrix = parseFloat(document.getElementById('f2-bottling-brix').value) || 5.0;

        const residualSugar = bottlingBrix * 0.01 * 0.2 * liquidWeight;
        const fruitSugar = fruitWeight * (fruitSugarRatio / 100);
        const totalSugar = residualSugar + fruitSugar + extraSugar;

        const co2Volumes = liquidVolume > 0 ? totalSugar / (4 * (liquidVolume / 1000)) : 0;

        safeSetText('f2-total-sugar', totalSugar.toFixed(1) + ' g');

        const gaugeEl = document.getElementById('f2-pressure-gauge');
        const valueEl = document.getElementById('f2-co2-value');
        const dangerHint = document.getElementById('f2-danger-hint');

        let widthPercent = Math.min(co2Volumes / 5 * 100, 100);
        gaugeEl.style.width = widthPercent + '%';

        if (co2Volumes > 3.5) {
            gaugeEl.style.backgroundColor = '#ef4444';
            if (valueEl) { valueEl.className = 'text-xl md:text-2xl mono font-black text-red-500 animate-pulse'; valueEl.textContent = co2Volumes.toFixed(2) + ' vol'; }
            if (dangerHint) { dangerHint.textContent = '⚠️ 高压危险！建议减少糖分或增加装瓶量。'; dangerHint.classList.remove('hidden'); }
        } else if (co2Volumes >= 3.0 && co2Volumes <= 3.5) {
            gaugeEl.style.backgroundColor = '#f59e0b';
            if (valueEl) { valueEl.className = 'text-xl md:text-2xl mono font-black text-amber-400'; valueEl.textContent = co2Volumes.toFixed(2) + ' vol'; }
            if (dangerHint) dangerHint.classList.add('hidden');
        } else if (co2Volumes >= 1.5 && co2Volumes < 3.0) {
            gaugeEl.style.backgroundColor = '#22c55e';
            if (valueEl) { valueEl.className = 'text-xl md:text-2xl mono font-black text-green-400'; valueEl.textContent = co2Volumes.toFixed(2) + ' vol'; }
            if (dangerHint) dangerHint.classList.add('hidden');
        } else {
            gaugeEl.style.backgroundColor = '#6b7280';
            if (valueEl) { valueEl.className = 'text-xl md:text-2xl mono font-black text-gray-400'; valueEl.textContent = co2Volumes.toFixed(2) + ' vol'; }
            if (dangerHint) dangerHint.classList.add('hidden');
        }

        const BASE_DEGREE_HOURS = 1728;
        const TARGET_PRESSURE = 2.5;

        let tanninDelay = 0;
        const tanninHint = document.getElementById('f2-tannin-hint');
        const additiveHeavy = document.getElementById('f2-additive-heavy')?.checked || false;
        const additiveLight = document.getElementById('f2-additive-light')?.checked || false;

        if (additiveHeavy) {
            tanninDelay = 18;
            if (tanninHint) { tanninHint.textContent = '⚠️ 发酵动力可能受限'; tanninHint.classList.remove('hidden'); tanninHint.style.display = 'block'; }
        } else if (additiveLight) {
            tanninDelay = 6;
            if (tanninHint) { tanninHint.textContent = ''; tanninHint.classList.add('hidden'); tanninHint.style.display = 'none'; }
        } else {
            tanninDelay = 0;
            if (tanninHint) { tanninHint.textContent = ''; tanninHint.classList.add('hidden'); tanninHint.style.display = 'none'; }
        }

        let avgTemp = 24;
        if (engine.logs.length > 0) {
            const lastLog = engine.logs[engine.logs.length - 1];
            avgTemp = lastLog.mode === 'diurnal'
                ? (lastLog.tempMin + lastLog.tempMax) / 2
                : lastLog.temp;
        }

        let baseHours = avgTemp > 0 ? BASE_DEGREE_HOURS / avgTemp : 0;
        let pressureFactor = co2Volumes > 0 ? TARGET_PRESSURE / co2Volumes : 1;
        let targetHours = baseHours * pressureFactor + tanninDelay;

        if (isNaN(targetHours) || targetHours <= 0) {
            safeSetText('f2-time-remaining', '等待数据...');
            return;
        }

        if (!window.f2CountdownStarted) {
            const hours = Math.floor(targetHours);
            const minutes = Math.floor((targetHours % 1) * 60);
            safeSetText('f2-time-remaining', `${hours}h${minutes}m`);
        }

        safeSetText('f2-chill-hint', `建议于目标时间前移入冰箱冷藏，锁定压力和风味。`);
    } catch (e) {
        console.error('calculateF2Pressure error:', e);
    }
}

function unlockF2UI() {
    try {
        window.f2Activated = true;

        const mask = document.getElementById('f2-disabled-mask');
        if (mask) mask.style.display = 'none';

        let lastBrix = null;
        let lastPh = null;
        for (let i = engine.logs.length - 1; i >= 0; i--) {
            if (engine.logs[i].brix !== null && engine.logs[i].brix !== undefined) {
                lastBrix = engine.logs[i].brix;
            }
            if (engine.logs[i].ph !== null && engine.logs[i].ph !== undefined) {
                lastPh = engine.logs[i].ph;
            }
            if (lastBrix !== null && lastPh !== null) break;
        }

        const bottlingBrixEl = document.getElementById('f2-bottling-brix');
        if (bottlingBrixEl) {
            bottlingBrixEl.value = lastBrix !== null ? lastBrix.toFixed(1) : '5.0';
        }
        const bottlingPhEl = document.getElementById('f2-bottling-ph');
        if (bottlingPhEl) {
            bottlingPhEl.value = lastPh !== null ? lastPh.toFixed(1) : '3.5';
        }

        const countdownBtn = document.getElementById('f2-start-countdown-btn');
        if (countdownBtn) countdownBtn.classList.remove('hidden');

        const endBtn = document.getElementById('end-f1-btn');
        if (endBtn) endBtn.style.display = 'none';
        const lockedHint = document.getElementById('f1-locked-hint');
        if (lockedHint) lockedHint.classList.remove('hidden');

        saveToStorage();
        showToast('🍾 F2 模块已解锁，请备料装瓶');
    } catch (e) {
        console.error('unlockF2UI error:', e);
    }
}

function autoCalculate() {
    try {
        const factor = document.getElementById('limiting-factor').value;
        const baseAmount = parseFloat(document.getElementById('base-amount').value);

        if (isNaN(baseAmount) || baseAmount <= 0) {
            alert("请输入有效的基准克数");
            return;
        }

        let starter, water, sugar, tea;

        if (factor === 'starter') {
            starter = baseAmount;
            water = Math.round(starter * 9);
        } else {
            water = baseAmount;
            starter = Math.round(water * 0.10);
        }

        sugar = Math.round(water * 0.10);
        tea = Math.round(water * 0.01);

        document.getElementById('m-starter').value = starter;
        document.getElementById('m-water').value = water;
        document.getElementById('m-sugar').value = sugar;
        document.getElementById('m-tea').value = tea;

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

            if (window.chillTimerInterval) clearInterval(window.chillTimerInterval);
            if (window.f2CountdownInterval) clearInterval(window.f2CountdownInterval);

            window.chillModeActive = false;
            window.chillEndTime = null;
            window.f2Activated = false;
            window.f2CountdownStarted = false;
            window.f1Locked = false;
            window.f2TargetTime = null;

            engine.logs = [];
            engine.mode = 'point';

            document.getElementById('vessel-d').value = '0';
            document.getElementById('liquid-h').value = '0';
            document.getElementById('m-water').value = '1000';
            document.getElementById('m-tea').value = '10';
            document.getElementById('m-sugar').value = '100';
            document.getElementById('m-starter').value = '100';
            document.getElementById('base-amount').value = '0';

            document.getElementById('input-temp').value = '';
            document.getElementById('input-temp-min').value = '';
            document.getElementById('input-temp-max').value = '';
            document.getElementById('input-brix').value = '';
            document.getElementById('input-ph').value = '';

            document.getElementById('f2-bottle-volume').value = '1000';
            document.getElementById('f2-fill-slider').value = '90';
            document.getElementById('f2-fill-percent').innerText = '90%';
            document.getElementById('f2-fruit-type').value = 'medium';
            document.getElementById('f2-fruit-weight').value = '0';
            document.getElementById('f2-extra-sugar').value = '0';
            document.getElementById('f2-bottling-brix').value = '5.0';
            document.getElementById('f2-bottling-ph').value = '3.5';

            if (document.getElementById('f2-additive-light')) document.getElementById('f2-additive-light').checked = false;
            if (document.getElementById('f2-additive-heavy')) document.getElementById('f2-additive-heavy').checked = false;

            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'flex';

            const countdownBtn = document.getElementById('f2-start-countdown-btn');
            if (countdownBtn) countdownBtn.classList.add('hidden');

            const endBtn = document.getElementById('end-f1-btn');
            if (endBtn) endBtn.style.display = 'block';
            const lockedHint = document.getElementById('f1-locked-hint');
            if (lockedHint) lockedHint.classList.add('hidden');

            const params = engine.initParams();
            updateUI(params);

            safeSetText('elapsed-time', '等待首条录入...');
            safeSetText('remaining-time', '0');
            safeSetText('current-brix', '--');
            safeSetText('bio-hours', '0.0 h');
            safeSetText('tta-est', '0.00');
            safeSetText('abv-est', '0.00%');
            const abvEl = document.getElementById('abv-est');
            if (abvEl) abvEl.className = 'text-3xl mono font-black text-red-500';
            safeSetText('smart-action', '环境就绪，等待发酵');
            const action = document.getElementById('smart-action');
            if (action) action.className = 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30';
            safeSetText('f1-prediction-text', '等待首条数据录入...');
            const cal1 = document.getElementById('add-to-calendar-f1');
            if (cal1) cal1.classList.add('hidden');

            safeSetText('f2-time-remaining', '等待数据...');
            safeSetText('f2-co2-value', '--');
            safeSetText('f2-chill-hint', '');

            const hc = document.getElementById('history-container');
            if (hc) hc.innerHTML = '';

            if (chart) {
                chart.destroy();
                chart = null;
            }
            initChart();

            updateDynamicHint();
            calculateF2Pressure();

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
        if (!selectedTime) {
            alert("请选择时间");
            return false;
        }

        const selectedDate = new Date(selectedTime);
        const now = new Date();
        if (selectedDate > now) {
            alert("时间不能晚于当前系统时间，请选择过去或现在的时间");
            return false;
        }

        const existingTimestamps = engine.logs.map(l => l.timestamp.getTime());
        const newTimestamp = selectedDate.getTime();
        if (existingTimestamps.includes(newTimestamp)) {
            alert("该时间点已有记录，请勿重复添加");
            return false;
        }

        if (engineMode === 'diurnal') {
            const tempMin = document.getElementById('input-temp-min').value;
            const tempMax = document.getElementById('input-temp-max').value;
            if (tempMin === '' || tempMax === '') {
                alert("昼夜模式必须填写最低温和最高温");
                return false;
            }
        } else {
            const temp = document.getElementById('input-temp').value;
            if (temp === '' || isNaN(parseFloat(temp))) {
                alert("请输入温度");
                return false;
            }
        }

        return true;
    } catch (e) {
        console.error('validateForm error:', e);
        return false;
    }
}

function initEventListeners() {
    document.getElementById('btn-auto-calc').onclick = autoCalculate;
    document.getElementById('btn-new-batch').onclick = startNewBatch;
    document.getElementById('btn-new-batch-footer').onclick = startNewBatch;
    document.getElementById('toggle-recipe').onclick = toggleRecipePanel;

    document.getElementById('btn-end-f1').addEventListener('click', () => {
        if (window.f1Locked) return;

        if (engine.logs.length === 0) {
            alert('没有任何记录，无法结束一发');
            return;
        }

        const lastLog = engine.logs[engine.logs.length - 1];
        if (!lastLog || (lastLog.brix === null && lastLog.brix === undefined)) {
            alert('没有有效的Brix数据');
            return;
        }

        window.f1Locked = true;
        unlockF2UI();

        const brixEl = document.getElementById('f2-bottling-brix');
        if (brixEl) {
            brixEl.value = lastLog.brix.toFixed(1);
        }

        const phEl = document.getElementById('f2-bottling-ph');
        if (phEl && lastLog.ph !== null && lastLog.ph !== undefined) {
            phEl.value = lastLog.ph.toFixed(1);
        }

        recomputeAndRender();
    });

    document.getElementById('f2-start-countdown-btn').onclick = () => {
        if (!window.f2Activated) return;

        const fruitWeight = parseFloat(document.getElementById('f2-fruit-weight').value) || 0;
        const extraSugar = parseFloat(document.getElementById('f2-extra-sugar').value) || 0;

        if (fruitWeight === 0 && extraSugar === 0) {
            alert('请至少输入水果重量或补糖量，以激活二发预测');
            return;
        }

        window.f2CountdownStarted = true;
        const countdownBtn = document.getElementById('f2-start-countdown-btn');
        if (countdownBtn) countdownBtn.classList.add('hidden');

        const chillBtn = document.getElementById('f2-start-chill');
        const calendarBtn = document.getElementById('add-to-calendar-f2');
        if (chillBtn) { chillBtn.disabled = false; chillBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        if (calendarBtn) { calendarBtn.disabled = false; calendarBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }

        calculateF2Pressure();
        saveToStorage();
        showToast('🍾 F2 二发倒计时已启动！');
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

        const existingTimestamps = engine.logs.map(l => l.timestamp.getTime());
        const selectedDate = new Date(document.getElementById('input-time').value);
        const newTimestamp = selectedDate.getTime();

        const brixVal = document.getElementById('input-brix').value;
        const phVal = document.getElementById('input-ph').value;
        const tempVal = parseFloat(document.getElementById('input-temp').value) || 0;
        const tempMinVal = parseFloat(document.getElementById('input-temp-min').value) || 0;
        const tempMaxVal = parseFloat(document.getElementById('input-temp-max').value) || 0;

        const duplicateExists = existingTimestamps.some(ts => {
            const existingLog = engine.logs.find(l => l.timestamp.getTime() === ts);
            if (!existingLog) return false;
            if (existingLog.brix !== null && brixVal !== '' && existingLog.brix === parseFloat(brixVal)) return true;
            if (existingLog.ph !== null && phVal !== '' && existingLog.ph === parseFloat(phVal)) return true;
            return false;
        });

        if (duplicateExists) {
            alert("已存在相同时间戳和数值的记录");
            return;
        }

        const data = {
            time: document.getElementById('input-time').value,
            mode: engine.mode,
            temp: tempVal,
            tempMin: tempMinVal,
            tempMax: tempMaxVal,
            brix: brixVal,
            ph: phVal
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
                const params = engine.initParams();
                updateUI(params);
                recomputeAndRender();
            } catch (e) {
                console.error('param input error:', e);
            }
        });
    });

    ['f2-bottle-volume', 'f2-fill-slider', 'f2-fruit-type', 'f2-additive-light', 'f2-additive-heavy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (window.f2Activated) calculateF2Pressure();
            });
            el.addEventListener('change', () => {
                if (window.f2Activated) calculateF2Pressure();
            });
        }
    });

    document.getElementById('f2-fill-slider').addEventListener('input', () => {
        try {
            const value = document.getElementById('f2-fill-slider').value;
            document.getElementById('f2-fill-percent').innerText = value + '%';
            if (window.f2Activated) calculateF2Pressure();
        } catch (e) {
            console.error('fill-slider error:', e);
        }
    });

    document.getElementById('f2-fruit-weight').addEventListener('input', () => {
        if (window.f2Activated) calculateF2Pressure();
    });

    document.getElementById('f2-extra-sugar').addEventListener('input', () => {
        if (window.f2Activated) calculateF2Pressure();
    });

    document.getElementById('f2-start-chill').addEventListener('click', startChillMode);
    document.getElementById('f2-add-chill-reminder').addEventListener('click', addChillReminderToCalendar);

    document.getElementById('f2-suggest-btn').addEventListener('click', () => {
        if (!window.f2Activated) return;
        try {
            const bottleVolume = parseFloat(document.getElementById('f2-bottle-volume').value) || 1000;
            const fillPercent = parseFloat(document.getElementById('f2-fill-slider').value) || 90;
            const liquidVolume = bottleVolume * (fillPercent / 100);
            const ratio = liquidVolume / 1000;
            document.getElementById('f2-fruit-weight').value = Math.round(50 * ratio);
            document.getElementById('f2-extra-sugar').value = Math.round(3 * ratio);
            calculateF2Pressure();
            showToast('已应用推荐配方');
        } catch (e) {
            console.error('f2-suggest-btn error:', e);
        }
    });

    document.getElementById('add-to-calendar-f2').addEventListener('click', () => {
        if (!window.f2Activated) {
            alert('请先完成一发，激活F2模块');
            return;
        }

        if (!window.f2TargetTime) {
            alert('请先输入数据获取预测时间');
            return;
        }

        const targetTime = new Date(window.f2TargetTime);
        const startTime = new Date(Date.now());

        const dtstart = startTime.toISOString().replace(/-/g, '').replace(/:/g, '').substring(0, 15);
        const dtend = targetTime.toISOString().replace(/-/g, '').replace(/:/g, '').substring(0, 15);

        const url = `data:text/calendar;charset=utf-8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${encodeURIComponent('康普茶二发装瓶提醒')}%0ADTSTART:${dtstart}%0ADTEND:${dtend}%0ADESCRIPTION:康普茶二发发酵预计达成目标压力，建议检查后冷藏。%0AEND:VEVENT%0AEND:VCALENDAR`;
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kombucha-f2-reminder.ics';
        a.click();
    });
}

function startChillMode() {
    try {
        if (!window.f2Activated) return;
        if (window.chillModeActive) return;

        if (!confirm('已移入冰箱？确认后将进入冷藏锁定模式，启动 24 小时倒计时。')) {
            return;
        }

        window.chillModeActive = true;
        window.chillEndTime = Date.now() + 24 * 60 * 60 * 1000;

        document.getElementById('f2-chill-mode').classList.remove('hidden');
        document.getElementById('f2-start-chill').classList.add('hidden');

        updateChillTimer();
        window.chillTimerInterval = setInterval(updateChillTimer, 1000);

        localStorage.setItem('chillMode', JSON.stringify({ active: true, endTime: window.chillEndTime }));
    } catch (e) {
        console.error('startChillMode error:', e);
    }
}

function updateChillTimer() {
    try {
        if (!window.chillEndTime) return;

        const remaining = window.chillEndTime - Date.now();
        if (remaining <= 0) {
            clearInterval(window.chillTimerInterval);
            safeSetText('f2-chill-status', '最佳赏味期已达标');
            safeSetText('f2-chill-timer', '完成!');
            localStorage.removeItem('chillMode');
            return;
        }

        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        safeSetText('f2-chill-timer',
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    } catch (e) {
        console.error('updateChillTimer error:', e);
    }
}

function addChillReminderToCalendar() {
    try {
        if (!window.chillEndTime) {
            alert('请先开始冷藏以设置提醒');
            return;
        }

        const endTime = new Date(window.chillEndTime);
        const startTime = new Date(window.chillEndTime - 30 * 60 * 1000);

        const dtstart = startTime.toISOString().replace(/-/g, '').replace(/:/g, '').substring(0, 15);
        const dtend = endTime.toISOString().replace(/-/g, '').replace(/:/g, '').substring(0, 15);

        const url = `data:text/calendar;charset=utf-8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${encodeURIComponent('康普茶开瓶提醒')}%0ADTSTART:${dtstart}%0ADTEND:${dtend}%0ADESCRIPTION:冷藏24小时已完成，可以开瓶品尝了。%0AEND:VEVENT%0AEND:VCALENDAR`;
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kombucha-chill-reminder.ics';
        a.click();
    } catch (e) {
        console.error('addChillReminderToCalendar error:', e);
    }
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

        const params = engine.initParams();
        updateUI(params);

        if (engine.mode === 'diurnal') {
            document.getElementById('btn-diurnal').click();
        }

        recomputeAndRender();

        if (window.f2Activated) {
            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'none';
            const countdownBtn = document.getElementById('f2-start-countdown-btn');
            if (countdownBtn) countdownBtn.classList.remove('hidden');

            const endBtn = document.getElementById('end-f1-btn');
            if (endBtn) endBtn.style.display = 'none';
            const lockedHint = document.getElementById('f1-locked-hint');
            if (lockedHint) lockedHint.classList.remove('hidden');

            calculateF2Pressure();
        } else {
            const mask = document.getElementById('f2-disabled-mask');
            if (mask) mask.style.display = 'flex';

            const endBtn = document.getElementById('end-f1-btn');
            if (endBtn) endBtn.style.display = 'block';
        }

        const savedChill = localStorage.getItem('chillMode');
        if (savedChill) {
            try {
                const data = JSON.parse(savedChill);
                if (data.active && data.endTime) {
                    window.chillModeActive = true;
                    window.chillEndTime = data.endTime;

                    document.getElementById('f2-chill-mode').classList.remove('hidden');
                    document.getElementById('f2-start-chill').classList.add('hidden');

                    if (window.chillEndTime > Date.now()) {
                        updateChillTimer();
                        window.chillTimerInterval = setInterval(updateChillTimer, 1000);
                    } else {
                        safeSetText('f2-chill-status', '最佳赏味期已达标');
                        safeSetText('f2-chill-timer', '完成!');
                    }
                }
            } catch (e) {
                localStorage.removeItem('chillMode');
            }
        }

        setInterval(() => {
            if (engine.logs.length > 0) {
                recomputeAndRender();
                if (window.f2Activated) {
                    calculateF2Pressure();
                }
            }
        }, 60000);
    } catch (e) {
        console.error('window.onload error:', e);
    }
};
