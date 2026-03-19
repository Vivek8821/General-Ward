class ScoringService {
    /**
     * Calculate an early warning score from a vital-sign payload.
     * Expects numeric or numeric-string values; returns null if required fields are missing.
     */
    calculateFromVital(data, timestamp) {
        if (!data) return null;

        const {
            bpSystolic,
            bpDiastolic,
            temp,
            pulse,
            respRate,
            spo2
        } = data;

        if (
            bpSystolic === undefined ||
            bpDiastolic === undefined ||
            temp === undefined ||
            pulse === undefined
        ) {
            return null;
        }

        const sys = Number(bpSystolic);
        const dia = Number(bpDiastolic);
        const temperature = Number(temp);
        const heartRate = Number(pulse);
        const rr = respRate !== undefined ? Number(respRate) : null;
        const oxygen = spo2 !== undefined ? Number(spo2) : null;

        if (
            !Number.isFinite(sys) ||
            !Number.isFinite(dia) ||
            !Number.isFinite(temperature) ||
            !Number.isFinite(heartRate)
        ) {
            return null;
        }

        const components = {};
        let total = 0;
        let hasRedFlag = false;

        // Respiratory rate (optional)
        if (rr !== null && Number.isFinite(rr)) {
            let points = 0;
            if (rr < 9 || rr > 30) points = 3;
            else if (rr >= 25 && rr <= 30) points = 2;
            else if ((rr >= 9 && rr <= 11) || (rr >= 21 && rr <= 24)) points = 1;

            total += points;
            if (points === 3) hasRedFlag = true;
            components.respRate = { value: rr, points, missing: false };
        } else {
            components.respRate = { value: null, points: 0, missing: true };
        }

        // SpO2 (optional)
        if (oxygen !== null && Number.isFinite(oxygen)) {
            let points = 0;
            if (oxygen < 92) points = 3;
            else if (oxygen >= 92 && oxygen <= 93) points = 2;
            else if (oxygen >= 94 && oxygen <= 95) points = 1;

            total += points;
            if (points === 3) hasRedFlag = true;
            components.spo2 = { value: oxygen, points, missing: false };
        } else {
            components.spo2 = { value: null, points: 0, missing: true };
        }

        // Systolic BP
        let bpPoints = 0;
        if (sys < 80 || sys > 220) bpPoints = 3;
        else if ((sys >= 80 && sys <= 89) || (sys >= 200 && sys <= 220)) bpPoints = 2;
        else if ((sys >= 90 && sys <= 99) || (sys >= 180 && sys <= 199)) bpPoints = 1;
        total += bpPoints;
        if (bpPoints === 3) hasRedFlag = true;
        components.systolic = { value: sys, points: bpPoints, missing: false };

        // Heart rate
        let hrPoints = 0;
        if (heartRate <= 40 || heartRate > 130) hrPoints = 3;
        else if (heartRate >= 111 && heartRate <= 130) hrPoints = 2;
        else if ((heartRate >= 41 && heartRate <= 50) || (heartRate >= 101 && heartRate <= 110)) hrPoints = 1;
        total += hrPoints;
        if (hrPoints === 3) hasRedFlag = true;
        components.heartRate = { value: heartRate, points: hrPoints, missing: false };

        // Temperature
        let tempPoints = 0;
        if (temperature <= 34.0 || temperature > 39.0) tempPoints = 3;
        else if (temperature >= 34.1 && temperature <= 35.0) tempPoints = 2;
        else if ((temperature >= 35.1 && temperature <= 36.0) || (temperature >= 38.1 && temperature <= 39.0)) tempPoints = 1;
        total += tempPoints;
        if (tempPoints === 3) hasRedFlag = true;
        components.temperature = { value: temperature, points: tempPoints, missing: false };

        let risk = 'low';
        if (total >= 7) risk = 'critical';
        else if (total >= 5) risk = 'high';
        else if (total >= 3) risk = 'medium';

        return {
            score: total,
            risk,
            hasRedFlag,
            components,
            timestamp: timestamp || null
        };
    }
}

module.exports = new ScoringService();

