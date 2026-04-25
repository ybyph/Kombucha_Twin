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
        this.initBrix = mW > 0 ? (mS / mW) * 100 : 10.0;
        
        this.teaPct = (mT / this.totalMass) * 100;
        
        const h = parseFloat(document.getElementById('liquid-h').value) || 10;
        this.avRatio = 1 / h;
        
        this.starterPct = ((mSt / this.totalMass) * 100);

        let brixClass = 'text-green-400';
        if (this.initBrix < 9.0 || this.initBrix > 12.0) {
            brixClass = 'text-yellow-400';
        }
        if (this.initBrix < 6.0 || this.initBrix > 15.0) {
            brixClass = 'text-red-400 font-bold';
        }

        let teaClass = 'text-green-400';
        if (this.teaPct < 0.8 || this.teaPct > 1.5) {
            teaClass = 'text-yellow-400';
        }
        if (this.teaPct < 0.5 || this.teaPct > 2.0) {
            teaClass = 'text-red-400 font-bold';
        }

        let starterClass = 'text-green-400';
        if (this.starterPct < 10 || this.starterPct > 20) {
            starterClass = 'text-yellow-400';
        }
        if (this.starterPct < 5 || this.starterPct > 30) {
            starterClass = 'text-red-400 font-bold';
        }

        return {
            theoryBrix: this.initBrix.toFixed(2),
            brixClass: brixClass,
            teaStatus: this.teaPct.toFixed(2) + '%',
            teaClass: teaClass,
            starterPct: this.starterPct.toFixed(0) + '%',
            starterClass: starterClass,
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
                predictions: [],
                remainingHours: 0,
                actionText: '环境就绪，等待发酵',
                actionClass: 'text-lg font-bold text-green-500 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/30',
                abvClass: 'text-3xl mono font-black text-red-500'
            };
        }
        
        const TARGET_TOTAL_DEGREE_HOURS = 300;
        
        const firstBrixRecord = this.logs.find(l => l.brix !== null);
        const f1InitBrix = firstBrixRecord ? firstBrixRecord.brix : this.initBrix;
        
        let processed = [];
        let lastRecordedBrix = f1InitBrix;
        let lastValidAbv = 0;
        const startTime = this.logs[0].timestamp;
        
        let cumulativeDegreeHours = 0;

        this.logs.forEach((log, i) => {
            let effectiveTemp = log.mode === 'diurnal' ? (log.tempMin + log.tempMax) / 2 : log.temp;
            const displayTemp = log.mode === 'diurnal' ? `${log.tempMin}-${log.tempMax}` : `${log.temp}`;
            const hoursElapsed = (log.timestamp - startTime) / 3600000;
            
            if (i > 0) {
                const prev = this.logs[i-1];
                const prevEffectiveTemp = prev.mode === 'diurnal' ? (prev.tempMin + prev.tempMax) / 2 : prev.temp;
                const avgTemp = (prevEffectiveTemp + effectiveTemp) / 2;
                const realHours = (log.timestamp - prev.timestamp) / 3600000;
                
                if (realHours > 0) {
                    cumulativeDegreeHours += avgTemp * realHours;
                }
            }
            
            if (log.brix !== null) {
                lastRecordedBrix = log.brix;
            }
            
            const brixDrop = Math.max(0, f1InitBrix - lastRecordedBrix);
            const abv = Math.max(0, brixDrop * 0.5);
            lastValidAbv = abv;
            const tta = Math.max(0, brixDrop * 0.08 + 0.15);

            processed.push({
                log,
                hoursElapsed,
                realBrix: lastRecordedBrix,
                abv: lastValidAbv,
                tta,
                ph: log.ph,
                displayTemp,
                cumulativeDegreeHours,
                effectiveTemp
            });
        });

        const latest = processed[processed.length - 1];
        
        let remainingDegreeHours = Math.max(0, TARGET_TOTAL_DEGREE_HOURS - latest.cumulativeDegreeHours);
        let remainingHours = latest.effectiveTemp > 0 ? remainingDegreeHours / latest.effectiveTemp : 0;
        
        const predictions = this.generatePredictions(latest, remainingHours, TARGET_TOTAL_DEGREE_HOURS);

        let actionText, actionClass, abvClass;
        
        if (latest.abv > 2.0) {
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
            bioHours: latest.cumulativeDegreeHours / latest.effectiveTemp,
            tta: latest.tta,
            abv: latest.abv,
            processed,
            predictions,
            remainingHours,
            actionText,
            actionClass,
            abvClass
        };
    }

    generatePredictions(latest, remainingHours, targetDegreeHours) {
        const predictions = [];
        const targetBrix = 4;
        const currentBrix = latest.realBrix;
        
        if (currentBrix <= targetBrix) return predictions;
        
        const currentTemp = latest.effectiveTemp;
        if (currentTemp <= 0) return predictions;
        
        const remainingDegreeHours = targetDegreeHours - latest.cumulativeDegreeHours;
        if (remainingDegreeHours <= 0) return predictions;
        
        const currentDecayRate = (latest.log.brix !== null && this.logs.length >= 2) ? 
            (() => {
                const prevWithBrix = [...this.logs].reverse().find((l, idx, arr) => idx > 0 && l.brix !== null && arr[idx-1].brix !== null);
                if (!prevWithBrix) return 0.1;
                const idx = this.logs.indexOf(prevWithBrix);
                const prevLog = this.logs[idx - 1];
                if (!prevLog || prevLog.brix === null) return 0.1;
                const hoursDiff = (prevWithBrix.timestamp - prevLog.timestamp) / 3600000;
                if (hoursDiff <= 0) return 0.1;
                const brixDiff = prevLog.brix - prevWithBrix.brix;
                const tempAvg = ((prevWithBrix.mode === 'diurnal' ? (prevWithBrix.tempMin + prevWithBrix.tempMax) / 2 : prevWithBrix.temp) + 
                                (prevLog.mode === 'diurnal' ? (prevLog.tempMin + prevLog.tempMax) / 2 : prevLog.temp)) / 2;
                return (brixDiff / hoursDiff) / tempAvg;
            })() : 0.1;
        
        let predBrix = currentBrix;
        let elapsedHours = 0;
        
        for (let i = 0; i < 12; i++) {
            elapsedHours += 2;
            const degreeHoursGain = currentTemp * 2;
            const brixDrop = currentDecayRate * degreeHoursGain;
            predBrix = Math.max(targetBrix, predBrix - brixDrop);
            predictions.push({
                hours: elapsedHours,
                brix: predBrix
            });
            
            if (predBrix <= targetBrix) break;
        }
        
        return predictions;
    }
}