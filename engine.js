class KombuchaEngineV4 {
    constructor() {
        this.logs = [];
        this.mode = 'point';
        this.totalMass = 0;
        this.initBrix = 12;
        this.avRatio = 0.125;
        this.teaPct = 0.6;
        this.starterPct = 18;
    }

    initParams() {
        const mW = parseFloat(document.getElementById('m-water').value) || 0;
        const mT = parseFloat(document.getElementById('m-tea').value) || 0;
        const mS = parseFloat(document.getElementById('m-sugar').value) || 0;
        const mSt = parseFloat(document.getElementById('m-starter').value) || 0;
        this.totalMass = mW + mT + mS + mSt;
        this.initBrix = this.totalMass > 0 ? (mS / this.totalMass) * 100 : 12;
        
        this.teaPct = (mT / this.totalMass) * 100;
        
        const h = parseFloat(document.getElementById('liquid-h').value) || 10;
        this.avRatio = 1 / h;
        
        this.starterPct = ((mSt / this.totalMass) * 100);

        return {
            theoryBrix: this.initBrix.toFixed(2),
            teaStatus: this.teaPct.toFixed(2) + '%',
            teaClass: this.teaPct < 0.5 ? 'text-red-400 font-bold' : 'text-green-400',
            starterPct: this.starterPct.toFixed(0) + '%',
            avValue: this.avRatio.toFixed(3)
        };
    }

    addRecord(data) {
        const record = {
            id: Date.now(),
            timestamp: new Date(data.time),
            mode: data.mode,
            temp: data.temp,
            tempMin: data.tempMin,
            tempMax: data.tempMax,
            brix: data.brix !== '' ? parseFloat(data.brix) : null,
            ph: data.ph !== '' ? parseFloat(data.ph) : null
        };
        this.logs.push(record);
        this.logs.sort((a, b) => a.timestamp - b.timestamp);
        return this.calculate();
    }

    deleteRecord(id) {
        this.logs = this.logs.filter(l => l.id !== id);
        return this.calculate();
    }

    calculate() {
        if (this.logs.length === 0) {
            return {
                bioHours: 0,
                tta: 0,
                abv: 0,
                processed: [],
                actionText: '环境就绪，等待发酵',
                actionClass: 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30',
                abvClass: 'text-3xl mono font-black text-red-500'
            };
        }
        
        let bioHours = 0;
        let processed = [];
        let currentBrix = this.initBrix;
        let lastRecordedBrix = this.initBrix;
        let lastBioHoursAtRecord = 0;
        const startTime = this.logs[0].timestamp;

        this.logs.forEach((log, i) => {
            if (i > 0) {
                const prev = this.logs[i-1];
                const hours = (log.timestamp - prev.timestamp) / 3600000;
                
                if (log.mode === 'diurnal') {
                    const tMin = log.tempMin, tMax = log.tempMax;
                    const tAvg = (tMin + tMax) / 2;
                    const amp = (tMax - tMin) / 2;
                    let periodSum = 0;
                    for (let step = 0; step < 10; step++) {
                        const t_inst = tAvg + amp * Math.sin((step/10) * Math.PI * 2);
                        periodSum += Math.pow(2, (t_inst - 28) / 10);
                    }
                    bioHours += (hours * (periodSum / 10));
                } else {
                    const avgT = (log.temp + (prev.mode === 'diurnal' ? (prev.tempMin + prev.tempMax)/2 : prev.temp)) / 2;
                    bioHours += (hours * Math.pow(2, (avgT - 28) / 10));
                }
            }

            if (log.brix !== null) {
                const realBrix = (1.642 * log.brix) - (0.642 * this.initBrix);
                currentBrix = Math.max(0, realBrix);
                lastRecordedBrix = currentBrix;
                lastBioHoursAtRecord = bioHours;
            } else {
                const bioDelta = bioHours - lastBioHoursAtRecord;
                const brixDecay = bioDelta * 0.05;
                currentBrix = Math.max(0, lastRecordedBrix - brixDecay);
            }

            const consumed = this.initBrix - currentBrix;
            const efficiency = Math.min(1.0, this.avRatio * 10);
            const abv = consumed * 0.5 * (1 - efficiency);
            const tta = consumed * 0.5 * efficiency;

            processed.push({
                log,
                hoursElapsed: (log.timestamp - startTime) / 3600000,
                realBrix: currentBrix,
                abv, tta, ph: log.ph,
                displayTemp: log.mode === 'diurnal' ? `${log.tempMin}-${log.tempMax}` : `${log.temp}`
            });
        });

        const latest = processed[processed.length - 1];
        let actionText, actionClass, abvClass;
        
        if (latest.abv > 0.5) {
            actionText = '🚨 酒精超标！立刻降温或冷藏';
            actionClass = 'text-lg font-bold text-red-500 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/30 animate-pulse';
            abvClass = 'text-3xl mono font-black text-red-500 animate-pulse';
        } else if (latest.tta > 0.6 && latest.tta < 0.9) {
            actionText = '⭐ 黄金风味期：建议装瓶二发';
            actionClass = 'text-lg font-bold text-amber-400 bg-amber-900/20 px-4 py-2 rounded-lg border border-amber-900/30';
            abvClass = 'text-3xl mono font-black text-red-500';
        } else {
            actionText = '代谢追踪中... 环境稳态：' + (this.avRatio >= 0.1 ? '优' : '限氧');
            actionClass = 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30';
            abvClass = 'text-3xl mono font-black text-red-500';
        }

        return {
            bioHours,
            tta: latest.tta,
            abv: latest.abv,
            processed,
            actionText,
            actionClass,
            abvClass
        };
    }
}