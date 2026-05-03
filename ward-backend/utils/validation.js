/**
 * Shared validation logic for clinical data.
 * These ranges are conservative and designed for general ward environments.
 */

const validateStats = (type, data) => {
    if (typeof data !== 'object' || data === null) return false;

    switch (type) {
        case 'vital': {
            const {
                bpSystolic,
                bpDiastolic,
                temp,
                pulse,
                respRate,
                spo2
            } = data;

            // All primary vital fields must be present
            if (
                bpSystolic === undefined ||
                bpDiastolic === undefined ||
                temp === undefined ||
                pulse === undefined
            ) {
                return false;
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
                return false;
            }

            // Physiological ranges
            if (sys < 50 || sys > 260) return false;
            if (dia < 30 || dia > 150) return false;
            // Support both Celsius (30-45) and Fahrenheit (86-115)
            if (temperature < 30 || (temperature > 45 && temperature < 86) || temperature > 115) return false;
            if (heartRate < 20 || heartRate > 250) return false;

            if (rr !== null) {
                if (!Number.isFinite(rr) || rr < 4 || rr > 60) return false;
            }

            if (oxygen !== null) {
                if (!Number.isFinite(oxygen) || oxygen < 50 || oxygen > 100) return false;
            }

            return true;
        }
        case 'diet': {
            const { mealType, consumedPercentage } = data;
            if (!mealType) return false;
            const consumed = Number(consumedPercentage);
            if (!Number.isFinite(consumed) || consumed < 0 || consumed > 100) return false;
            return true;
        }
        case 'sleep': {
            const { hoursSlept, quality } = data;
            const hours = Number(hoursSlept);
            if (!Number.isFinite(hours) || hours < 0 || hours > 24) return false;
            if (!quality) return false;
            return true;
        }
        case 'symptom': {
            const { severity, description } = data;
            if (!description) return false;
            const sev = Number(severity);
            if (!Number.isFinite(sev) || sev < 0 || sev > 10) return false;
            return true;
        }
        default:
            return false;
    }
};

module.exports = { validateStats };
