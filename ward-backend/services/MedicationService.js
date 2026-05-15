const medicationRepository = require('../repositories/MedicationRepository');
const patientRepository = require('../repositories/PatientRepository');
const stockRepo = require('../repositories/pharmacy/StockRepository');
const txService = require('../services/pharmacy/TransactionService');
const clinicalAuditService = require('../services/ClinicalAuditService');
const { safeRecordDispenseCharge } = require('../services/billing/PharmacyBillingHook');
const crypto = require('crypto');

class MedicationService {
  async getMedications(patientId, tenantId) {
    return medicationRepository.findAllByPatientId(patientId, tenantId);
  }

  async prescribeMedication(patientId, tenantId, user, payload) {
    // SECURITY FIX: Verify patient belongs to tenant
    const patientExists = await patientRepository.findById(patientId, tenantId);
    if (!patientExists) throw new Error('Access denied by tenant scope or patient not found');

    const id = crypto.randomUUID();
    const { name, dosage, route, frequency, scheduledTimes, prn, startDate } = payload;
    
    const medId = await medicationRepository.create({
      id,
      tenantId,
      patientId,
      name,
      dosage,
      route: route || 'Oral / Default',
      frequency,
      scheduledTimes,
      prn,
      startDate: startDate || new Date().toISOString().split('T')[0],
      prescribedBy: user.name
    });

    await clinicalAuditService.recordMedicationAction({
      tenantId,
      user,
      patientId,
      medicationId: id,
      action: 'prescribe',
      details: `${name} ${dosage} ${frequency}`
    });

    return { id, name, dosage, route };
  }

  async updateMedicationStatus(medId, patientId, tenantId, user, status) {
    await medicationRepository.updateStatus(medId, patientId, tenantId, status);
    
    await clinicalAuditService.recordMedicationAction({
      tenantId,
      user,
      patientId,
      medicationId: medId,
      action: 'status_update',
      details: `status set to ${status}`
    });

    return { message: 'Medication status updated successfully' };
  }

  async getAdministrations(patientId, tenantId, query) {
    const { limit, cursor } = query;
    let cursorTs, cursorId;
    if (cursor) {
      [cursorTs, cursorId] = cursor.split('|');
    }
    
    return medicationRepository.findAdministrationsByPatientId(patientId, tenantId, {
      limit: limit ? Number(limit) : 200,
      cursorTs,
      cursorId
    });
  }

  async administerMedication(medId, patientId, tenantId, user, payload) {
    const id = crypto.randomUUID();
    const { status, notes, timestamp } = payload;
    
    const med = await medicationRepository.findById(medId, tenantId);
    if (!med) throw new Error('Medication not found');

    const reasonCode = status === 'given' ? null : status;
    const doseActuallyGiven = status === 'given' ? med.dosage : null;

    // Phase 3: Inventory Integration (with Batch/FEFO awareness)
    // If the medication is being GIVEN, try to deduct from pharmacy stock
    if (status === 'given') {
      try {
        // Find by name in EDL
        const inventoryItem = await stockRepo.findByName(med.name, tenantId);
        if (inventoryItem) {
          const stockResult = await txService.adjustStock(
            inventoryItem.id,
            tenantId,
            -1, // Deduct 1 itemUnit (e.g. 1 tablet)
            'dispense',
            user,
            {
              patientId,
              notes: `Dispensed for administration to ${patientId}. Medication record: ${medId}`
            }
          );
          if (stockResult.batchId) {
            console.info(`[MedicationService] FEFO dispensed from batch ${stockResult.batchId} for med ${medId}`);
          }

          // Auto-bill the dispense. Best-effort: never blocks clinical action.
          await safeRecordDispenseCharge({
            patientId,
            tenantId,
            sourceRef: id, // administration id — one charge per administration
            description: `${med.name} (${med.dosage})`,
            quantity: 1,
            unitPrice: Number(inventoryItem.costPerUnit) || 0,
            createdBy: user.id || 'system',
          });
        }
      } catch (err) {
        console.error('[MedicationService] Stock deduction failed:', err.message);
        // We log but don't block administration (clinical priority)
      }
    }

    await medicationRepository.createAdministration({
      id,
      tenantId,
      medicationId: medId,
      patientId,
      status,
      notes,
      doseActuallyGiven,
      reasonCode,
      administeredBy: user.name,
      timestamp
    });

    await clinicalAuditService.recordMedicationAdministration({
      tenantId,
      user,
      patientId,
      medicationId: medId,
      administrationId: id,
      status
    });

    return { id, message: 'Dose recorded' };
  }

  async updateAdministration(adminId, patientId, tenantId, user, payload) {
    const { status, notes } = payload;
    const admin = await medicationRepository.findAdministrationById(adminId, tenantId);
    if (!admin) throw new Error('Administration record not found');

    const reasonCode = status === 'given' ? null : status;
    const doseActuallyGiven = status === 'given' ? admin.medDosage : null;

    await medicationRepository.updateAdministration(adminId, patientId, tenantId, {
      status,
      notes,
      doseActuallyGiven,
      reasonCode
    });

    await clinicalAuditService.recordMedicationAdministration({
      tenantId,
      user,
      patientId,
      medicationId: admin.medicationId,
      administrationId: adminId,
      status
    });

    return { message: 'Administration record updated' };
  }

  async deleteAdministration(adminId, patientId, tenantId, user) {
    await medicationRepository.deleteAdministration(adminId, patientId, tenantId);

    await clinicalAuditService.recordMedicationAdministration({
      tenantId,
      user,
      patientId,
      administrationId: adminId,
      status: 'deleted'
    });

    return { message: 'Administration record deleted' };
  }
}

module.exports = new MedicationService();
