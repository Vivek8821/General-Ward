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
        case 'history': {
            const { description, notes, conditions } = data;
            // Medical history should at least have a description or notes
            if (!description && !notes && (!conditions || conditions.length === 0)) return false;
            return true;
        }
        default:
            return false;
    }
};

// ── Shared primitive validators ──────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VALID_ROLES = ['doctor', 'nurse', 'pharmacist', 'admin'];
const VALID_SHIFTS = ['morning', 'afternoon', 'night'];
const VALID_DISCHARGE_MODES = ['home', 'ama', 'transferred', 'lama', 'expired'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function requireString(val, name, maxLen = 5000) {
    if (val === undefined || val === null || typeof val !== 'string' || val.trim().length === 0) {
        return `${name} is required`;
    }
    if (val.length > maxLen) {
        return `${name} must be ${maxLen} characters or fewer`;
    }
    return null;
}

function optionalString(val, name, maxLen = 5000) {
    if (val === undefined || val === null) return null;
    if (typeof val !== 'string') return `${name} must be a string`;
    if (val.length > maxLen) return `${name} must be ${maxLen} characters or fewer`;
    return null;
}

function requireEnum(val, name, allowed) {
    if (!val) return `${name} is required`;
    if (!allowed.includes(val)) return `${name} must be one of: ${allowed.join(', ')}`;
    return null;
}

function isValidEmail(val) {
    return typeof val === 'string' && EMAIL_RE.test(val);
}

function validatePassword(val) {
    if (!val || typeof val !== 'string') return 'password is required';
    if (val.length < 8) return 'password must be at least 8 characters';
    if (val.length > 128) return 'password must be 128 characters or fewer';
    // Character-composition rules omitted deliberately: length is the strongest
    // predictor of resistance to brute force. Breach checking runs asynchronously
    // in the service layer via checkPasswordSecurity().
    return null;
}

// ── Domain-specific validators ───────────────────────────────────────────────

function validateSignupPayload({ hospitalName, hospitalCode, adminName, email, employeeCode, password } = {}) {
    const errors = [];
    const checks = [
        requireString(hospitalName, 'hospitalName', 200),
        requireString(hospitalCode, 'hospitalCode', 50),
        requireString(adminName, 'adminName', 200),
        requireString(employeeCode, 'employeeCode', 100),
    ];
    for (const e of checks) if (e) errors.push(e);
    if (!email || !isValidEmail(email)) errors.push('A valid email address is required');
    if (email && email.length > 254) errors.push('email must be 254 characters or fewer');
    const pwErr = validatePassword(password);
    if (pwErr) errors.push(pwErr);
    return errors;
}

function validateUserPayload({ name, role, email, password } = {}) {
    const errors = [];
    const nameErr = requireString(name, 'name', 200);
    if (nameErr) errors.push(nameErr);
    const roleErr = requireEnum(role, 'role', VALID_ROLES);
    if (roleErr) errors.push(roleErr);
    if (!email || !isValidEmail(email)) errors.push('A valid email address is required');
    if (email && email.length > 254) errors.push('email must be 254 characters or fewer');
    const pwErr = validatePassword(password);
    if (pwErr) errors.push(pwErr);
    return errors;
}

const PATIENT_ALLOWED_FIELDS = new Set([
    'name', 'mrn', 'bedNumber', 'dob', 'diagnosis', 'allergies',
    'careIntensity', 'admittedAt', 'status',
    'dpdpaNoticeGiven', 'guardianName', 'guardianContact',
    'guardianNoticeReceived', 'dataRightsNominee', 'dataNomineeRelationship',
]);

function validatePatientCreate(body = {}) {
    const errors = [];
    const checks = [
        requireString(body.name, 'name', 300),
        requireString(body.mrn, 'mrn', 50),
        requireString(body.bedNumber, 'bedNumber', 50),
        requireString(body.dob, 'dob', 20),
        requireString(body.diagnosis, 'diagnosis', 1000),
    ];
    for (const e of checks) if (e) errors.push(e);
    const allergyErr = optionalString(body.allergies, 'allergies', 500);
    if (allergyErr) errors.push(allergyErr);
    const unknown = Object.keys(body).filter(k => !PATIENT_ALLOWED_FIELDS.has(k));
    if (unknown.length > 0) errors.push(`Unknown field(s): ${unknown.join(', ')}`);
    return errors;
}

function validatePatientUpdate(body = {}, userRole) {
    const errors = [];
    const unknown = Object.keys(body).filter(k => !PATIENT_ALLOWED_FIELDS.has(k));
    if (unknown.length > 0) errors.push(`Unknown field(s): ${unknown.join(', ')}`);
    if (body.name !== undefined) { const e = requireString(body.name, 'name', 300); if (e) errors.push(e); }
    if (body.diagnosis !== undefined && userRole === 'nurse') {
        errors.push('Nurses are not permitted to update the diagnosis field');
    }
    if (body.diagnosis !== undefined) { const e = optionalString(body.diagnosis, 'diagnosis', 1000); if (e) errors.push(e); }
    if (body.bedNumber !== undefined) { const e = optionalString(body.bedNumber, 'bedNumber', 50); if (e) errors.push(e); }
    return errors;
}

function validateDischargePayload(body = {}) {
    const errors = [];
    const checks = [
        requireString(body.reason, 'reason', 2000),
        requireString(body.medicationHistory, 'medicationHistory', 5000),
    ];
    for (const e of checks) if (e) errors.push(e);
    if (body.dischargeMode !== undefined) {
        const e = requireEnum(body.dischargeMode, 'dischargeMode', VALID_DISCHARGE_MODES);
        if (e) errors.push(e);
    }
    const textFields = ['duration', 'admissionDiagnosis', 'dischargeDiagnosis',
        'conditionAtDischarge', 'dischargePrescription', 'followUpSchedule',
        'dischargeInstructions', 'dietaryRestrictions'];
    for (const f of textFields) {
        if (body[f] !== undefined) {
            const e = optionalString(body[f], f, 5000);
            if (e) errors.push(e);
        }
    }
    return errors;
}

function validateHandoverNote(body = {}) {
    const errors = [];
    const noteErr = requireString(body.note, 'note', 5000);
    if (noteErr) errors.push(noteErr);
    if (body.shift !== undefined) {
        const e = requireEnum(body.shift, 'shift', VALID_SHIFTS);
        if (e) errors.push(e);
    }
    const tagsErr = optionalString(body.tags, 'tags', 500);
    if (tagsErr) errors.push(tagsErr);
    return errors;
}

function validateTask(body = {}) {
    const errors = [];
    const titleErr = requireString(body.title, 'title', 500);
    if (titleErr) errors.push(titleErr);
    const descErr = optionalString(body.description, 'description', 2000);
    if (descErr) errors.push(descErr);
    if (body.priority !== undefined) {
        const e = requireEnum(body.priority, 'priority', VALID_TASK_PRIORITIES);
        if (e) errors.push(e);
    }
    return errors;
}

function validateInventoryPayload(body = {}) {
    const VALID_TYPES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Patch', 'Inhaler', 'Other'];
    const errors = [];
    const nameErr = requireString(body.name, 'name', 300);
    if (nameErr) errors.push(nameErr);
    const compErr = optionalString(body.composition, 'composition', 300);
    if (compErr) errors.push(compErr);
    if (body.type !== undefined) {
        const e = requireEnum(body.type, 'type', VALID_TYPES);
        if (e) errors.push(e);
    }
    const catErr = optionalString(body.category, 'category', 100);
    if (catErr) errors.push(catErr);
    if (body.costPerUnit !== undefined) {
        const cost = Number(body.costPerUnit);
        if (!Number.isFinite(cost) || cost < 0) errors.push('costPerUnit must be a non-negative number');
    }
    if (body.quantityPerUnit !== undefined) {
        const qty = Number(body.quantityPerUnit);
        if (!Number.isFinite(qty) || qty <= 0) errors.push('quantityPerUnit must be a positive number');
    }
    return errors;
}

function validateWastePayload(body = {}) {
    const VALID_REASON_CODES = ['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'RECALLED', 'OTHER'];
    const errors = [];
    if (!body.stockId || typeof body.stockId !== 'string') errors.push('stockId is required');
    if (!body.quantityWasted || Number(body.quantityWasted) <= 0) errors.push('quantityWasted must be a positive number');
    if (!body.unit || typeof body.unit !== 'string') errors.push('unit is required');
    const rcErr = requireEnum(body.reasonCode, 'reasonCode', VALID_REASON_CODES);
    if (rcErr) errors.push(rcErr);
    const notesErr = optionalString(body.reasonNotes, 'reasonNotes', 1000);
    if (notesErr) errors.push(notesErr);
    return errors;
}

function validateBarcodeRegister(body = {}) {
    const VALID_TARGET_TYPES = ['STOCK', 'BATCH'];
    const errors = [];
    const bcErr = requireString(body.barcode, 'barcode', 200);
    if (bcErr) errors.push(bcErr);
    const ttErr = requireEnum(body.targetType, 'targetType', VALID_TARGET_TYPES);
    if (ttErr) errors.push(ttErr);
    if (!body.targetId || typeof body.targetId !== 'string') errors.push('targetId is required');
    const notesErr = optionalString(body.notes, 'notes', 500);
    if (notesErr) errors.push(notesErr);
    return errors;
}

function validateMedicalHistory(body = {}) {
    const errors = [];
    const fields = ['surgicalHistory', 'familyHistory', 'socialHistory'];
    for (const f of fields) {
        if (body[f] !== undefined) {
            const e = optionalString(body[f], f, 5000);
            if (e) errors.push(e);
        }
    }
    if (body.comorbidities !== undefined) {
        if (typeof body.comorbidities !== 'string' && !Array.isArray(body.comorbidities)) {
            errors.push('comorbidities must be a string or array');
        } else if (typeof body.comorbidities === 'string' && body.comorbidities.length > 5000) {
            errors.push('comorbidities must be 5000 characters or fewer');
        }
    }
    return errors;
}

function validateClinicalPresentation(body = {}) {
    const errors = [];
    const hpiErr = optionalString(body.historyOfPresentingIllness, 'historyOfPresentingIllness', 10000);
    if (hpiErr) errors.push(hpiErr);
    const examinerErr = optionalString(body.examinedBy, 'examinedBy', 200);
    if (examinerErr) errors.push(examinerErr);
    if (body.physicalExamFindings !== undefined) {
        if (typeof body.physicalExamFindings !== 'object' || Array.isArray(body.physicalExamFindings)) {
            errors.push('physicalExamFindings must be an object');
        }
    }
    return errors;
}

function validateEscalationReason(reason) {
    return requireString(reason, 'reason', 1000);
}

function bad(res, errors) {
    return res.status(400).json({ error: 'Validation failed', details: Array.isArray(errors) ? errors : [errors], code: 'VALIDATION_ERROR' });
}

module.exports = {
    validateStats,
    validateSignupPayload,
    validateUserPayload,
    validatePatientCreate,
    validatePatientUpdate,
    validateDischargePayload,
    validateHandoverNote,
    validateTask,
    validateInventoryPayload,
    validateWastePayload,
    validateBarcodeRegister,
    validateMedicalHistory,
    validateClinicalPresentation,
    validateEscalationReason,
    bad,
};
