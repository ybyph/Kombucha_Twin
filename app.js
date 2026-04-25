/**
 * Kombucha Twin v4.0 - 物理接管最终版
 * 目标：强行修复 A/V 比、一键配方、数据存储
 */

let state = JSON.parse(localStorage.getItem('kombucha_logs')) || { logs: [] };

document.addEventListener('DOMContentLoaded', () => {
    console.log("Kombucha Twin 逻辑已装载");
    
    // 1. A/V 传质比计算 (1/h) - 解决你截图里 0.125 的死锁
    const calcAV = () => {
        // 尝试获取两个可能的 ID (m-height 或 h-input)
        const hInput = document.getElementById('m-height') || document.querySelector('[id*="height"]');
        const display = document.getElementById('av-ratio-value');
        if (display && hInput) {
            const h = parseFloat(hInput.value) || 0;
            // 物理公式 A/V = 1/h。如果高度是 18.5，结果必须是 0.054
            const result = h > 0 ? (1 / h).toFixed(3) : "0.000";
            display.innerText = result;
            console.log("A/V 更新为:", result);
        }
    };
    
    // 监听高度变化
    const hEl = document.getElementById('m-height');
    if (hEl) hEl.addEventListener('input', calcAV);

    // 2. 一键应用 (修正 1:7 比例)
    const btnAuto = document.getElementById('btn-auto-calc');
    if (btnAuto) {
        btnAuto.onclick = () => {
            const base = parseFloat(document.getElementById('base-amount').value) || 0;
            const factor = document.getElementById('limiting-factor').value;
            let water = factor === 'starter' ? base * 7 : base;
            let starter = factor === 'starter' ? base : base / 7;
            
            document.getElementById('m-water').value = Math.round(water);
            document.getElementById('m-starter').value = Math.round(starter);
            document.getElementById('m-tea').value = Math.round(water * 0.01);
            document.getElementById('m-sugar').value = Math.round(water * 0.1);
            
            // 强制刷新所有读数
            if (typeof updateTheoryBrix === 'function') updateTheoryBrix();
            calcAV();
        };
    }

    // 3. 采样日志提交 (尝试适配所有可能的按钮 ID)
    const btnSubmit = document.getElementById('btn-submit') || document.getElementById('btn-add-log');
    if (btnSubmit) {
        btnSubmit.onclick = () => {
            const brix = document.getElementById('input-brix')?.value;
            const ph = document.getElementById('input-ph')?.value;
            
            const newLog = {
                timestamp: new Date().toISOString(),
                temp: parseFloat(document.getElementById('input-temp')?.value) || 25,
                brix: parseFloat(brix) || 10,
                ph: parseFloat(ph) || 3.5
            };
            
            state.logs.push(newLog);
            localStorage.setItem('kombucha_logs', JSON.stringify(state));
            
            // 清空并刷新
            document.querySelectorAll('input[id*="input-"]').forEach(i => i.value = "");
            refreshAll();
            alert("记录成功");
        };
    }

    function refreshAll() {
        // ABV 计算
        if (state.logs.length > 0) {
            const start = state.logs[0];
            const last = state.logs[state.logs.length - 1];
            const abv = Math.max(0, (start.brix - last.brix) * 0.5).toFixed(2);
            const abvEl = document.getElementById('abv-display') || document.getElementById('current-abv');
            if (abvEl) abvEl.innerText = abv + "%";
        }
        // 尝试刷新矩阵
        renderLogMatrix();
    }

    function renderLogMatrix() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = state.logs.map((log, i) => `
            <div style="background:rgba(0,0,0,0.3); padding:10px; margin-bottom:5px; border-radius:5px; font-size:12px;">
                ${new Date(log.timestamp).toLocaleTimeString()} | Brix: ${log.brix} | pH: ${log.ph}
            </div>
        `).reverse().join('');
    }

    // 初始化运行一次
    calcAV();
    refreshAll();
});

// 计算理论 Brix
function updateTheoryBrix() {
    const w = parseFloat(document.getElementById('m-water')?.value) || 0;
    const s = parseFloat(document.getElementById('m-sugar')?.value) || 0;
    const res = w > 0 ? ((s / w) * 100).toFixed(1) : "0.0";
    const el = document.getElementById('theory-brix');
    if (el) el.innerText = res;
}