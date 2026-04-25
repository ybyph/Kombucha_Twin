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

function saveToStorage() {
    const params = {
        'vessel-d': document.getElementById('vessel-d').value,
        'liquid-h': document.getElementById('liquid-h').value,
        'm-water': document.getElementById('m-water').value,
        'm-tea': document.getElementById('m-tea').value,
        'm-sugar': document.getElementById('m-sugar').value,
        'm-starter': document.getElementById('m-starter').value
    };
    
    const f2Data = {
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
        
        if (data.f2Data) {
            const f2Map = {
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

function updateTimeDisplay(result) {
    if (engine.logs.length === 0) {
        document.getElementById('elapsed-time').innerText = '等待首条录入...';
        document.getElementById('remaining-time').innerText = '-';
        document.getElementById('current-brix').innerText = '--';
        return;
    }
    
    const firstLog = engine.logs[0];
    const now = new Date();
    const elapsedMs = now - firstLog.timestamp;
    
    const days = Math.floor(elapsedMs / 86400000);
    const hours = Math.floor((elapsedMs % 86400000) / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    
    if (days > 0) {
        document.getElementById('elapsed-time').innerText = `第 ${days} 天 ${hours} 小时 ${minutes} 分钟`;
    } else if (hours > 0) {
        document.getElementById('elapsed-time').innerText = `${hours} 小时 ${minutes} 分钟`;
    } else {
        document.getElementById('elapsed-time').innerText = `${minutes} 分钟`;
    }
    
    const latest = result.processed[result.processed.length - 1];
    document.getElementById('current-brix').innerText = latest.realBrix.toFixed(1);
    
    if (result.remainingHours !== undefined && result.remainingHours > 0) {
        const remDays = Math.floor(result.remainingHours / 24);
        const remHours = Math.floor(result.remainingHours % 24);
        const remMins = Math.floor((result.remainingHours % 1) * 60);
        if (remDays > 0) {
            document.getElementById('remaining-time').innerText = `${remDays}天${remHours}h${remMins}m`;
        } else if (remHours > 0) {
            document.getElementById('remaining-time').innerText = `${remHours}h${remMins}m`;
        } else {
            document.getElementById('remaining-time').innerText = `${remMins}m`;
        }
    } else {
        document.getElementById('remaining-time').innerText = '-';
    }
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

    updateTimeDisplay(result);

    const container = document.getElementById('history-container');
    container.innerHTML = '';
    
    if (result.processed.length === 0) {
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

    const labels = result.processed.map(p => `T+${p.hoursElapsed.toFixed(0)}h`);
    const actualData = result.processed.map(p => p.realBrix);
    const phData = result.processed.map(p => p.ph);
    
    let predictLabels = [...labels];
    let predictData = [...actualData];
    let maxTime = result.processed.length > 0 ? result.processed[result.processed.length - 1].hoursElapsed : 0;
    
    if (result.predictions && result.predictions.length > 0) {
        const lastHour = result.processed[result.processed.length - 1].hoursElapsed;
        result.predictions.forEach((pred, i) => {
            const predHour = lastHour + (i + 1) * 2;
            predictLabels.push(`T+${predHour.toFixed(0)}h`);
            predictData.push(pred.brix);
            maxTime = Math.max(maxTime, predHour);
        });
    }
    
    if (result.remainingHours !== undefined && result.remainingHours > 0) {
        const lastHour = result.processed.length > 0 ? result.processed[result.processed.length - 1].hoursElapsed : 0;
        const totalTime = lastHour + result.remainingHours;
        const extendedMax = Math.ceil(totalTime / 12) * 12 + 24;
        maxTime = Math.max(maxTime, extendedMax);
    }
    
    const step = maxTime > 48 ? 24 : 12;
    const numSteps = Math.ceil(maxTime / step);
    
    const axisLabels = [];
    const alignedActualData = [];
    const alignedPhData = [];
    const alignedPredictData = [];
    
    for (let i = 0; i <= numSteps; i++) {
        const hour = i * step;
        axisLabels.push(`T+${hour}h`);
        
        const actualIndex = labels.indexOf(`T+${hour}h`);
        if (actualIndex >= 0) {
            alignedActualData.push(actualData[actualIndex]);
            alignedPhData.push(phData[actualIndex]);
        } else {
            alignedActualData.push(null);
            alignedPhData.push(null);
        }
        
        const predictIndex = predictLabels.indexOf(`T+${hour}h`);
        if (predictIndex >= 0) {
            alignedPredictData.push(predictData[predictIndex]);
        } else {
            let interpolatedBrix = null;
            if (predictLabels.length > 0) {
                for (let j = 0; j < predictLabels.length - 1; j++) {
                    const currHour = parseFloat(predictLabels[j].replace('T+', '').replace('h', ''));
                    const nextHour = parseFloat(predictLabels[j + 1].replace('T+', '').replace('h', ''));
                    if (hour >= currHour && hour <= nextHour) {
                        const ratio = (hour - currHour) / (nextHour - currHour);
                        interpolatedBrix = predictData[j] + (predictData[j + 1] - predictData[j]) * ratio;
                        break;
                    }
                }
            }
            alignedPredictData.push(interpolatedBrix);
        }
    }

    chart.data.labels = axisLabels;
    chart.data.datasets[0].data = alignedActualData;
    chart.data.datasets[1].data = alignedPhData;
    chart.data.datasets[2].data = alignedPredictData;
    chart.options.scales.x.max = undefined;
    chart.update();
}

function deleteEntry(id) {
    const result = engine.deleteRecord(id);
    renderResults(result);
    saveToStorage();
    updateUIGuide();
}

function showToast(msg = '记录已保存') {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
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
}

function calculateF2Pressure() {
    const bottleVolume = parseFloat(document.getElementById('f2-bottle-volume').value) || 1000;
    const fillPercent = parseFloat(document.getElementById('f2-fill-slider').value) || 90;
    const fruitType = document.getElementById('f2-fruit-type').value;
    const fruitWeight = parseFloat(document.getElementById('f2-fruit-weight').value) || 0;
    const extraSugar = parseFloat(document.getElementById('f2-extra-sugar').value) || 0;
    const additiveLight = document.getElementById('f2-additive-light')?.checked || false;
    const additiveHeavy = document.getElementById('f2-additive-heavy')?.checked || false;
    
    const liquidVolume = bottleVolume * (fillPercent / 100);
    const liquidWeight = liquidVolume;
    document.getElementById('f2-liquid-weight').innerText = liquidWeight.toFixed(0) + ' g';
    
    const maxFruitWeight = liquidWeight * 0.2;
    const fruitInput = document.getElementById('f2-fruit-weight');
    const fruitHint = document.getElementById('f2-fruit-hint');
    
    const fruitRatio = liquidWeight > 0 ? (fruitWeight / liquidWeight) * 100 : 0;
    const fruitRatioEl = document.getElementById('f2-fruit-ratio');
    
    fruitInput.style.backgroundColor = '';
    fruitInput.style.borderColor = '';
    fruitRatioEl.textContent = fruitWeight > 0 ? fruitRatio.toFixed(1) + '%' : '0.0%';
    
    if (fruitWeight > maxFruitWeight) {
        fruitInput.style.backgroundColor = '#374151';
        fruitInput.style.borderColor = '#ef4444';
        fruitHint.textContent = '空间不足，建议减量 (最大 ' + maxFruitWeight.toFixed(0) + 'g)';
        fruitHint.style.color = '#ef4444';
    } else if (fruitRatio > 0 && fruitRatio < 5) {
        fruitHint.textContent = '气泡可能较弱';
        fruitHint.style.color = '#fbbf24';
    } else if (fruitRatio > 15) {
        fruitHint.textContent = '纤维过多，建议减量';
        fruitHint.style.color = '#fbbf24';
    } else {
        fruitHint.textContent = '';
    }
    
    const sugarInput = document.getElementById('f2-extra-sugar');
    const sugarHint = document.getElementById('f2-sugar-hint');
    const sugarRatioEl = document.getElementById('f2-sugar-ratio');
    
    sugarInput.style.backgroundColor = '';
    sugarInput.style.borderColor = '';
    
    const sugarPercent = liquidWeight > 0 ? (extraSugar / liquidWeight) * 100 : 0;
    sugarRatioEl.textContent = extraSugar > 0 ? sugarPercent.toFixed(1) + '%' : '0.0%';
    
    sugarHint.textContent = '';
    
    const fruitSugarRatio = FRUIT_SUGAR_RATIO[fruitType] || 0;
    
    let latestBrix = 5.0;
    if (engine.logs.length > 0) {
        const lastRecord = engine.logs[engine.logs.length - 1];
        if (lastRecord.brix !== undefined && !isNaN(lastRecord.brix)) {
            latestBrix = lastRecord.brix;
        } else {
            const processed = engine.calculate().processed;
            if (processed.length > 0) {
                latestBrix = processed[processed.length - 1].realBrix || 5.0;
            }
        }
    }
    
    const residualSugar = latestBrix * 0.01 * 0.1 * liquidWeight;
    const fruitSugar = fruitWeight * (fruitSugarRatio / 100);
    const totalSugar = residualSugar + fruitSugar + extraSugar;
    
    const co2Volumes = liquidVolume > 0 ? totalSugar / (4 * (liquidVolume / 1000)) : 0;
    
    document.getElementById('f2-total-sugar').innerText = totalSugar.toFixed(1) + ' g';
    
    const gaugeEl = document.getElementById('f2-pressure-gauge');
    const valueEl = document.getElementById('f2-co2-value');
    const dangerHint = document.getElementById('f2-danger-hint');
    
    let widthPercent = Math.min(co2Volumes / 5 * 100, 100);
    gaugeEl.style.width = widthPercent + '%';
    
    if (co2Volumes > 4.0) {
        gaugeEl.style.backgroundColor = '#ef4444';
        valueEl.className = 'text-xl md:text-2xl mono font-black text-red-500 animate-pulse';
        valueEl.style.color = '#ef4444';
        dangerHint.textContent = '⚠️ 当前残糖极高，装瓶极度危险！请在一发更酸后再装瓶。';
        dangerHint.classList.remove('hidden');
    } else if (co2Volumes < 1.5) {
        gaugeEl.style.backgroundColor = '#6b7280';
        valueEl.className = 'text-xl md:text-2xl mono font-black text-gray-400';
        dangerHint.classList.add('hidden');
    } else if (co2Volumes >= 1.5 && co2Volumes < 3.5) {
        gaugeEl.style.backgroundColor = '#22c55e';
        valueEl.className = 'text-xl md:text-2xl mono font-black text-green-400';
        dangerHint.classList.add('hidden');
    } else {
        gaugeEl.style.backgroundColor = '#ef4444';
        valueEl.className = 'text-xl md:text-2xl mono font-black text-red-500';
        dangerHint.classList.add('hidden');
    }
    
    valueEl.textContent = co2Volumes.toFixed(2) + ' vol';
    
    if (extraSugar === 0 && co2Volumes < 1.5 && totalSugar > 0) {
        sugarHint.textContent = '燃料不足，建议加 2-4g 砂糖以产生气泡';
        sugarHint.classList.remove('hidden');
        sugarHint.style.color = '#fbbf24';
    } else if (extraSugar > 15) {
        sugarHint.textContent = '警告：糖分过多，请减少补糖以防炸瓶';
        sugarHint.classList.remove('hidden');
        sugarHint.style.color = '#ef4444';
    }

    const BASE_DEGREE_HOURS = 1728;
    const TARGET_PRESSURE = 2.5;
    
    let tanninDelay = 0;
    if (additiveHeavy || additiveLight) {
        tanninDelay = 12;
    }
    
    const tanninHint = document.getElementById('f2-tannin-hint');
    if (additiveHeavy || additiveLight) {
        tanninHint.classList.remove('hidden');
        tanninHint.style.display = 'block';
    } else {
        tanninHint.classList.add('hidden');
        tanninHint.style.display = 'none';
    }
    
    let avgTemp = 24;
    if (engine.logs.length > 0) {
        const lastLog = engine.logs[engine.logs.length - 1];
        avgTemp = lastLog.mode === 'diurnal' 
            ? (lastLog.tempMin + lastLog.tempMax) / 2 
            : lastLog.temp;
    }
    
    let baseHours = BASE_DEGREE_HOURS / avgTemp;
    let pressureFactor = co2Volumes > 0 ? TARGET_PRESSURE / co2Volumes : 1;
    let targetHours = baseHours * pressureFactor + tanninDelay;
    
    if (isNaN(targetHours) || targetHours <= 0) {
        document.getElementById('f2-time-remaining').innerText = '等待数据...';
        document.getElementById('f2-chill-hint').innerText = '';
        return;
    }
    
    const hours = Math.floor(targetHours);
    const minutes = Math.floor((targetHours - hours) * 60);
    
    if (hours > 0) {
        document.getElementById('f2-time-remaining').innerText = `${hours} 小时 ${minutes} 分钟`;
    } else {
        document.getElementById('f2-time-remaining').innerText = `${minutes} 分钟`;
    }
    
    const targetTime = new Date(Date.now() + targetHours * 3600000);
    const hoursStr = targetTime.getHours().toString().padStart(2, '0');
    const minsStr = targetTime.getMinutes().toString().padStart(2, '0');
    const dateStr = `${targetTime.getMonth() + 1}/${targetTime.getDate()}`;
    
    let chillHint = `建议于 ${dateStr} ${hoursStr}:${minsStr} 移入冰箱冷藏，锁定压力和风味。`;
    if (hasTannin) {
        chillHint += ' (含高单宁/精油材料)';
    }
    document.getElementById('f2-chill-hint').innerText = chillHint;
}

function autoCalculate() {
    const factor = document.getElementById('limiting-factor').value;
    const baseAmount = parseFloat(document.getElementById('base-amount').value);
    
    if (isNaN(baseAmount) || baseAmount <= 0) {
        alert("请输入有效的基准克数");
        return;
    }
    
    let starter, water, sugar, tea;
    
    if (factor === 'starter') {
        starter = baseAmount;
        water = Math.round(starter * 7);
    } else {
        water = baseAmount;
        starter = Math.round(water / 7);
    }
    
    sugar = Math.round(water * 0.1);
    tea = Math.round(water * 0.01);
    
    document.getElementById('m-starter').value = starter;
    document.getElementById('m-water').value = water;
    document.getElementById('m-sugar').value = sugar;
    document.getElementById('m-tea').value = tea;
    
    const params = engine.initParams();
    updateUI(params);
    const result = engine.calculate();
    renderResults(result);
    saveToStorage();
    showToast('配方已应用');
}

function startNewBatch() {
    if (confirm('确定要开始新批次吗？这将清空所有历史记录和配置。')) {
        localStorage.clear();
        engine.logs = [];
        engine.mode = 'point';
        
        document.getElementById('vessel-d').value = '0';
        document.getElementById('liquid-h').value = '0';
        document.getElementById('m-water').value = '0';
        document.getElementById('m-tea').value = '0';
        document.getElementById('m-sugar').value = '0';
        document.getElementById('m-starter').value = '0';
        document.getElementById('base-amount').value = '0';
        
        document.getElementById('f2-bottle-volume').value = '1000';
        document.getElementById('f2-fill-slider').value = '90';
        document.getElementById('f2-fill-percent').innerText = '90%';
        document.getElementById('f2-fruit-type').value = 'medium';
        document.getElementById('f2-fruit-weight').value = '0';
        document.getElementById('f2-extra-sugar').value = '0';
        if (document.getElementById('f2-additive-light')) {
            document.getElementById('f2-additive-light').checked = false;
        }
        if (document.getElementById('f2-additive-heavy')) {
            document.getElementById('f2-additive-heavy').checked = false;
        }
        document.getElementById('f2-tannin-hint').classList.add('hidden');
        
        const params = engine.initParams();
        updateUI(params);
        const result = engine.calculate();
        renderResults(result);
        calculateF2Pressure();
        
        document.getElementById('btn-submit').disabled = false;
        
        showToast('新批次已开始');
        updateUIGuide();
    }
}

function toggleRecipePanel() {
    const content = document.getElementById('recipe-content');
    const toggleBtn = document.getElementById('toggle-recipe');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        toggleBtn.innerText = '折叠';
    } else {
        content.classList.add('hidden');
        toggleBtn.innerText = '展开';
    }
}

function updateUIGuide() {
    const leftPanel = document.getElementById('left-panel');
    const recipePanel = document.getElementById('recipe-panel');
    const hasLogs = engine.logs.length > 0;
    
    if (hasLogs) {
        leftPanel.classList.add('lg:col-span-2');
        leftPanel.classList.remove('lg:col-span-3');
        
        document.querySelector('.lg\\:col-span-6').classList.add('lg:col-span-7');
        document.querySelector('.lg\\:col-span-6').classList.remove('lg:col-span-6');
        
        document.querySelector('.lg\\:col-span-3').classList.add('lg:col-span-3');
        
        recipePanel.classList.add('border-amber-900/20');
        recipePanel.classList.remove('border-gray-800');
        
        toggleRecipePanel();
    } else {
        leftPanel.classList.remove('lg:col-span-2');
        leftPanel.classList.add('lg:col-span-3');
        
        document.querySelector('.lg\\:col-span-6, .lg\\:col-span-7').classList.remove('lg:col-span-7');
        document.querySelector('.lg\\:col-span-6, .lg\\:col-span-7').classList.add('lg:col-span-6');
        
        recipePanel.classList.remove('border-amber-900/20');
        recipePanel.classList.add('border-gray-800');
        
        document.getElementById('recipe-content').classList.remove('hidden');
        document.getElementById('toggle-recipe').innerText = '折叠';
    }
}

function initEventListeners() {
    document.getElementById('btn-auto-calc').onclick = autoCalculate;
    document.getElementById('btn-new-batch').onclick = startNewBatch;
    document.getElementById('toggle-recipe').onclick = toggleRecipePanel;
    
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
        updateUIGuide();
    };

    ['vessel-d', 'liquid-h', 'm-water', 'm-tea', 'm-sugar', 'm-starter'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const params = engine.initParams();
            updateUI(params);
            const result = engine.calculate();
            renderResults(result);
            calculateF2Pressure();
            saveToStorage();
        });
    });

    document.getElementById('f2-fill-slider').addEventListener('input', () => {
        const value = document.getElementById('f2-fill-slider').value;
        document.getElementById('f2-fill-percent').innerText = value + '%';
        calculateF2Pressure();
    });

    ['f2-bottle-volume', 'f2-fruit-type', 'f2-fruit-weight', 'f2-extra-sugar', 'f2-additive-light', 'f2-additive-heavy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateF2Pressure);
            el.addEventListener('change', calculateF2Pressure);
        }
    });
    
    document.getElementById('f2-suggest-btn').addEventListener('click', () => {
        const bottleVolume = parseFloat(document.getElementById('f2-bottle-volume').value) || 1000;
        const fillPercent = parseFloat(document.getElementById('f2-fill-slider').value) || 90;
        const liquidVolume = bottleVolume * (fillPercent / 100);
        const ratio = liquidVolume / 1000;
        document.getElementById('f2-fruit-weight').value = Math.round(50 * ratio);
        document.getElementById('f2-extra-sugar').value = Math.round(3 * ratio);
        calculateF2Pressure();
        showToast('已应用推荐配方');
    });
}

window.onload = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('input-time').value = now.toISOString().slice(0, 16);
    
    initChart();
    initEventListeners();
    
    loadFromStorage();
    
    const params = engine.initParams();
    updateUI(params);
    
    if (engine.mode === 'diurnal') {
        document.getElementById('btn-diurnal').click();
    }
    
    const result = engine.calculate();
    renderResults(result);
    
    updateUIGuide();
    calculateF2Pressure();
    
    setInterval(() => {
        if (engine.logs.length > 0) {
            const result = engine.calculate();
            updateTimeDisplay(result);
            calculateF2Pressure();
        }
    }, 60000);
};