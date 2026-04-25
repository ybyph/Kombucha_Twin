// 核心逻辑：强制修正版 
document.addEventListener('DOMContentLoaded', () => { 
    // 1. 强制校准理论 Brix 计算 (使用 糖/水 比例) 
    const updateTheoryBrix = () => { 
        const water = parseFloat(document.getElementById('m-water').value) || 0; 
        const sugar = parseFloat(document.getElementById('m-sugar').value) || 0; 
        const theoryBrix = water > 0 ? ((sugar / water) * 100).toFixed(1) : "0.0"; 
        const display = document.getElementById('theory-brix'); 
        if (display) display.innerText = theoryBrix; 
    }; 
 
    // 2. 绑定"结束一发"按钮的救命电线 
    const endF1Btn = document.getElementById('btn-end-f1'); 
    if (endF1Btn) { 
        endF1Btn.addEventListener('click', () => { 
            // 获取一发最后的数据 
            const lastLog = state.logs[state.logs.length - 1]; 
            if (!lastLog) { 
                alert("请至少录入一条日志数据后再结束一发"); 
                return; 
            } 
            // 激活 F2 模块 
            document.getElementById('f2-panel').classList.remove('hidden'); 
            document.getElementById('f2-starter-brix').value = lastLog.brix; 
            alert("一发已结束，数据已同步至二发！"); 
            window.scrollTo(0, document.getElementById('f2-panel').offsetTop); 
        }); 
    } 
 
    // 3. 修复 Dashboard 计算死锁 (增加强力容错) 
    const updateDashboard = () => { 
        try { 
            if (state.logs.length < 1) return; 
             
            const startBrix = parseFloat(state.logs[0].brix) || 10; 
            const latestBrix = parseFloat(state.logs[state.logs.length - 1].brix) || startBrix; 
             
            // ABV 强制公式 
            const abv = Math.max(0, (startBrix - latestBrix) * 0.5).toFixed(2); 
            document.getElementById('abv-display').innerText = abv + "%"; 
             
            // 剩余时间 (防崩溃保护) 
            calculateRemainingTime(); 
        } catch (e) { 
            console.error("看板渲染崩溃，已启动保护模式", e); 
        } 
    }; 
     
    // 初始调用 
    updateTheoryBrix(); 
});
