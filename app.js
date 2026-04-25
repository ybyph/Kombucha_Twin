/**
 * Kombucha Twin v4.0 - 物理逻辑修复全家桶
 * 覆盖功能：A/V计算、配方应用、采样记录展示、看板更新、二发流转
 */

// 1. 状态与初始化
let state = JSON.parse(localStorage.getItem('kombucha_logs')) || { logs: [] };

document.addEventListener('DOMContentLoaded', () => {
    // 强制执行一次初始化计算
    updateTheoryBrix();
    calculateAVRatio();
    updateDashboard();
    renderLogMatrix();
    
    // 2. A/V 传质比实时计算逻辑
    const calcAV = () => {
        const diameter = parseFloat(document.getElementById('m-diameter')?.value) || 0;
        const height = parseFloat(document.getElementById('m-height')?.value) || 0;
        const avDisplay = document.getElementById('av-ratio-value');
        if (avDisplay && height > 0) {
            // A/V = (PI * r^2) / (PI * r^2 * h) = 1/h
            // 这里根据 UI 需求显示
            const av = (1 / height).toFixed(3);
            avDisplay.innerText = av;
        }
    };
    document.querySelectorAll('#m-diameter, #m-height').forEach(el => el.oninput = calcAV);

    // 3. 一键应用配方 (1:7 比例)
    const btnAutoCalc = document.getElementById('btn-auto-calc');
    if (btnAutoCalc) {
        btnAutoCalc.onclick = () => {
            const factor = document.getElementById('limiting-factor').value;
            const baseAmount = parseFloat(document.getElementById('base-amount').value) || 0;
            let water = factor === 'starter' ? baseAmount * 7 : baseAmount;
            let starter = factor === 'starter' ? baseAmount : baseAmount / 7;
            
            document.getElementById('m-water').value = Math.round(water);
            document.getElementById('m-starter').value = Math.round(starter);
            document.getElementById('m-tea').value = Math.round(water * 0.01);
            document.getElementById('m-sugar').value = Math.round(water * 0.1);
            
            updateTheoryBrix();
            alert("配方已应用");
        };
    }

    // 4. 采样日志提交与矩阵显示
    const btnAddLog = document.getElementById('btn-submit');
    if (btnAddLog) {
        btnAddLog.onclick = () => {
            const brix = document.getElementById('input-brix').value;
            const ph = document.getElementById('input-ph').value;
            if (state.logs.length === 0 && (!brix || !ph)) return alert("首条记录必须填写 Brix/pH");

            const newLog = {
                timestamp: document.getElementById('input-time').value || new Date().toISOString(),
                temp: parseFloat(document.getElementById('input-temp').value) || 25,
                brix: parseFloat(brix) || (state.logs.length > 0 ? state.logs[state.logs.length-1].brix : 10),
                ph: parseFloat(ph) || (state.logs.length > 0 ? state.logs[state.logs.length-1].ph : 3.5)
            };

            state.logs.push(newLog);
            localStorage.setItem('kombucha_logs', JSON.stringify(state));
            
            // 清空并刷新
            document.querySelectorAll('#input-temp, #input-brix, #input-ph').forEach(i => i.value = "");
            updateDashboard();
            renderLogMatrix();
        };
    }

    // 5. 渲染采样日志矩阵 (让“记录”看得见)
    function renderLogMatrix() {
        const container = document.getElementById('history-container'); // 确保 ID 正确
        if (!container) return;
        
        container.innerHTML = state.logs.map((log, index) => `
            <div class="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center mb-2 border-l-2 border-amber-500">
                <div>
                    <div class="text-[10px] text-gray-500">${new Date(log.timestamp).toLocaleString()}</div>
                    <div class="text-sm font-mono">Brix: ${log.brix} | pH: ${log.ph} | ${log.temp}°C</div>
                </div>
                <button onclick="deleteLog(${index})" class="text-red-500 text-xs">删除</button>
            </div>
        `).reverse().join('');
    }

    // 6. 物理计算 Dashboard
    function updateDashboard() {
        if (state.logs.length === 0) return;
        const start = state.logs[0];
        const last = state.logs[state.logs.length - 1];
        
        // ABV
        const abv = Math.max(0, (start.brix - last.brix) * 0.5).toFixed(2);
        const abvEl = document.getElementById('abv-display');
        if (abvEl) abvEl.innerText = abv + "%";

        // 剩余时间 (积温逻辑)
        const elapsedHours = (new Date() - new Date(start.timestamp)) / 3600000;
        const avgTemp = state.logs.reduce((s, l) => s + l.temp, 0) / state.logs.length;
        const remain = Math.max(0, (2100 / avgTemp) - elapsedHours);
        const timeEl = document.getElementById('remaining-time');
        if (timeEl) timeEl.innerText = Math.round(remain) + "h";
    }

    // 理论 Brix 计算
    function updateTheoryBrix() {
        const w = parseFloat(document.getElementById('m-water').value) || 0;
        const s = parseFloat(document.getElementById('m-sugar').value) || 0;
        const res = w > 0 ? ((s / w) * 100).toFixed(1) : "0.0";
        const el = document.getElementById('theory-brix');
        if (el) el.innerText = res;
    }

    // 暴露给 window 方便 HTML 调用
    window.deleteLog = (index) => {
        state.logs.splice(index, 1);
        localStorage.setItem('kombucha_logs', JSON.stringify(state));
        renderLogMatrix();
        updateDashboard();
    };
    
    window.resetBatch = () => {
        if(confirm("重置所有数据？")) { localStorage.clear(); location.reload(); }
    };
});