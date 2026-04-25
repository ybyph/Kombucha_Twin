/**
 * Kombucha Twin v4.0 - 终极物理接管版
 * 修复：A/V 实时更新、一键应用 1:7、采样记录矩阵、ABV 强制计算
 */

let state = JSON.parse(localStorage.getItem('kombucha_logs')) || { logs: [] };

document.addEventListener('DOMContentLoaded', () => {
    // 1. A/V 传质比计算 (1/h)
    const calcAV = () => {
        const h = parseFloat(document.getElementById('m-height')?.value) || 0;
        const display = document.getElementById('av-ratio-value');
        if (display) {
            // 物理公式：A/V = 1/h。如果高度是 18.5，结果应为 0.054
            display.innerText = h > 0 ? (1 / h).toFixed(3) : "0.000";
        }
    };
    document.querySelectorAll('#m-diameter, #m-height').forEach(el => el.oninput = calcAV);

    // 2. 一键应用 (1:7 黄金比例)
    const btnAuto = document.getElementById('btn-auto-calc');
    if (btnAuto) {
        btnAuto.onclick = () => {
            const factor = document.getElementById('limiting-factor').value;
            const base = parseFloat(document.getElementById('base-amount').value) || 0;
            let water = factor === 'starter' ? base * 7 : base;
            let starter = factor === 'starter' ? base : base / 7;
            
            document.getElementById('m-water').value = Math.round(water);
            document.getElementById('m-starter').value = Math.round(starter);
            document.getElementById('m-tea').value = Math.round(water * 0.01);
            document.getElementById('m-sugar').value = Math.round(water * 0.1);
            updateTheoryBrix();
        };
    }

    // 3. 采样日志提交 (使用 HTML 真实的 btn-submit ID)
    const btnSubmit = document.getElementById('btn-submit');
    if (btnSubmit) {
        btnSubmit.onclick = () => {
            const brix = document.getElementById('input-brix').value;
            const ph = document.getElementById('input-ph').value;
            if (state.logs.length === 0 && (!brix || !ph)) return alert("首条记录必填 Brix/pH");

            state.logs.push({
                timestamp: new Date().toISOString(),
                temp: parseFloat(document.getElementById('input-temp').value) || 25,
                brix: parseFloat(brix) || (state.logs[0]?.brix || 10),
                ph: parseFloat(ph) || (state.logs[0]?.ph || 3.5)
            });
            localStorage.setItem('kombucha_logs', JSON.stringify(state));
            
            // 清空输入并刷新界面
            document.querySelectorAll('#input-temp, #input-brix, #input-ph').forEach(i => i.value = "");
            refreshUI();
        };
    }

    // 4. 刷新所有 UI 模块
    function refreshUI() {
        updateDashboard();
        renderLogMatrix();
        // 如果页面引用了 Chart.js 且有 renderRoadmap 函数则调用
        if (typeof renderRoadmap === 'function') renderRoadmap(state.logs);
    }

    function renderLogMatrix() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = state.logs.map((log, i) => `
            <div class="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center mb-2 border-l-2 border-amber-500">
                <div class="text-xs font-mono">
                    <span class="text-gray-500">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <br/>Brix: ${log.brix} | pH: ${log.ph}
                </div>
                <button onclick="deleteLog(${i})" class="text-red-500 text-[10px]">删除</button>
            </div>
        `).reverse().join('');
    }

    function updateDashboard() {
        if (state.logs.length === 0) return;
        const start = state.logs[0];
        const last = state.logs[state.logs.length - 1];
        
        // ABV 计算
        const abv = Math.max(0, (start.brix - last.brix) * 0.5).toFixed(2);
        const abvDisplay = document.getElementById('abv-display');
        if (abvDisplay) abvDisplay.innerText = abv + "%";

        // 剩余时间
        const elapsed = (new Date() - new Date(start.timestamp)) / 3600000;
        const remain = Math.max(0, (2100 / 25) - elapsed); // 简化积温逻辑
        const timeDisplay = document.getElementById('remaining-time');
        if (timeDisplay) timeDisplay.innerText = Math.round(remain) + "h";
    }

    function updateTheoryBrix() {
        const w = parseFloat(document.getElementById('m-water').value) || 0;
        const s = parseFloat(document.getElementById('m-sugar').value) || 0;
        const res = w > 0 ? ((s / w) * 100).toFixed(1) : "0.0";
        const el = document.getElementById('theory-brix');
        if (el) el.innerText = res;
    }

    // 全局方法
    window.deleteLog = (i) => {
        state.logs.splice(i, 1);
        localStorage.setItem('kombucha_logs', JSON.stringify(state));
        refreshUI();
    };

    // 初始运行
    calcAV();
    updateTheoryBrix();
    refreshUI();
});