/** 
 * Kombucha 酿造助手 - 物理逻辑修复版 
 * 严格对齐 ID: m-water, m-tea, m-sugar, m-starter 
 */ 

// 全局状态管理 
let state = JSON.parse(localStorage.getItem('kombucha_logs')) || { logs: [] }; 

document.addEventListener('DOMContentLoaded', () => { 
    initApp(); 
}); 

function initApp() { 
    // 1. 绑定一键应用逻辑 (Noma 1:7 比例) 
    const btnAutoCalc = document.getElementById('btn-auto-calc'); 
    if (btnAutoCalc) { 
        btnAutoCalc.onclick = () => { 
            const factor = document.getElementById('limiting-factor').value; 
            const baseAmount = parseFloat(document.getElementById('base-amount').value) || 0; 
            let water, tea, sugar, starter; 

            if (factor === 'starter') { 
                starter = baseAmount; 
                water = baseAmount * 7; 
            } else { 
                water = baseAmount; 
                starter = baseAmount / 7; 
            } 
            tea = water * 0.01; 
            sugar = water * 0.1; 

            // 物理写入 
            document.getElementById('m-water').value = Math.round(water); 
            document.getElementById('m-tea').value = Math.round(tea); 
            document.getElementById('m-sugar').value = Math.round(sugar); 
            document.getElementById('m-starter').value = Math.round(starter); 
            
            updateTheoryBrix(); 
            console.log("配方已应用：1:7 比例"); 
        }; 
    } 

    // 2. 初始 Brix 计算逻辑 
    const updateTheoryBrix = () => { 
        const water = parseFloat(document.getElementById('m-water').value) || 0; 
        const sugar = parseFloat(document.getElementById('m-sugar').value) || 0; 
        const theoryBrix = water > 0 ? ((sugar / water) * 100).toFixed(1) : "0.0"; 
        const display = document.getElementById('theory-brix'); 
        if (display) display.innerText = theoryBrix; 
    }; 

    // 监听输入变化 
    document.querySelectorAll('#m-water, #m-sugar').forEach(el => { 
        el.oninput = updateTheoryBrix; 
    }); 

    // 3. 提交日志逻辑 
    const btnAddLog = document.getElementById('btn-submit'); 
    if (btnAddLog) { 
        btnAddLog.onclick = () => { 
            const temp = document.getElementById('input-temp').value; 
            const brix = document.getElementById('input-brix').value; 
            const ph = document.getElementById('input-ph').value; 

            if (state.logs.length === 0 && (!brix || !ph)) { 
                alert("首条记录必须填写初始 Brix 和 pH！"); 
                return; 
            } 

            const newLog = { 
                timestamp: new Date().toISOString(), 
                temp: parseFloat(temp) || 25, 
                brix: parseFloat(brix) || (state.logs.length > 0 ? state.logs[state.logs.length-1].brix : 10), 
                ph: parseFloat(ph) || (state.logs.length > 0 ? state.logs[state.logs.length-1].ph : 3.5) 
            }; 

            state.logs.push(newLog); 
            localStorage.setItem('kombucha_logs', JSON.stringify(state)); 
            
            // 清空输入 
            document.getElementById('input-temp').value = ""; 
            document.getElementById('input-brix').value = ""; 
            document.getElementById('input-ph').value = ""; 

            updateDashboard(); 
            alert("记录成功！"); 
        }; 
    } 

    // 4. 看板更新函数 (ABV & 积温计算) 
    const updateDashboard = () => { 
        const logs = state.logs; 
        if (logs.length === 0) return; 

        // ABV 计算 
        const startBrix = logs[0].brix; 
        const latestBrix = logs[logs.length - 1].brix; 
        const currentAbv = Math.max(0, (startBrix - latestBrix) * 0.5).toFixed(2); 
        document.getElementById('abv-display').innerText = currentAbv + "%"; 

        // 剩余时间计算 (基于 Noma 2100 积温小时) 
        const startTime = new Date(logs[0].timestamp); 
        const elapsedHours = (new Date() - startTime) / (1000 * 60 * 60); 
        const avgTemp = logs.reduce((sum, l) => sum + l.temp, 0) / logs.length; 
        const remainingHours = Math.max(0, (2100 / avgTemp) - elapsedHours); 
        document.getElementById('remaining-time').innerText = Math.round(remainingHours) + " 小时"; 

        // 如果有 Roadmap 渲染函数则调用 
        if (window.renderRoadmap) window.renderRoadmap(logs); 
    }; 

    // 5. F1 结束转 F2 逻辑 
    const btnEndF1 = document.getElementById('btn-end-f1'); 
    if (btnEndF1) { 
        btnEndF1.onclick = () => { 
            if (state.logs.length === 0) return alert("请先添加至少一条记录"); 
            const lastBrix = state.logs[state.logs.length - 1].brix; 
            
            const f2Panel = document.getElementById('f2-panel'); 
            if (f2Panel) { 
                f2Panel.classList.remove('hidden'); 
                document.getElementById('f2-starter-brix').value = lastBrix; 
                f2Panel.scrollIntoView({ behavior: 'smooth' }); 
            } 
        }; 
    } 

    // 6. 二发实时约束 
    document.querySelectorAll('#f2-fruit-weight, #f2-extra-sugar').forEach(el => { 
        el.oninput = () => { 
            if (parseFloat(el.value) > 200) el.value = 200; 
            // 此处可扩展 F2 压力预测逻辑 
        }; 
    }); 

    // 初始渲染 
    updateTheoryBrix(); 
    updateDashboard(); 
} 

// 物理清除功能 
window.resetBatch = () => { 
    if (confirm("确定要删除所有记录开始新批次吗？")) { 
        localStorage.removeItem('kombucha_logs'); 
        state.logs = []; 
        location.reload(); 
    } 
};
