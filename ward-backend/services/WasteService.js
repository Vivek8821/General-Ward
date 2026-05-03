const crypto = require('crypto');
const dbAdapter = require('../dbAdapter');
const wasteRepository = require('../repositories/WasteRepository');
const pharmacyRepository = require('../repositories/PharmacyRepository');

const VALID_REASON_CODES = ['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'SPILL', 'OTHER'];

function serviceError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

class WasteService {
  /**
   * Initiate a new waste record (status = PENDING).
   * Stock is NOT deducted at this stage — only on witness confirmation.
   *
   * @param {string} tenantId
   * @param {Object} payload - { stockId, batchId?, quantityWasted, unit, reasonCode, reasonNotes? }
   * @param {Object} user - Authenticated user (from req.user): { id, name, role, tenantId }
   * @returns {Object} The created PENDING waste record
   */
  async initiateWaste(tenantId, payload, user) {
    const { stockId, batchId, quantityWasted, unit, reasonCode, reasonNotes } = payload;

    // ── Validation ──────────────────────────────────────────────────
    if (!stockId) throw serviceError('stockId is required', 400);
    if (!unit) throw serviceError('unit is required', 400);
    if (!quantityWasted || quantityWasted <= 0) {
      throw serviceError('quantityWasted must be a positive number', 400);
    }
    if (!VALID_REASON_CODES.includes(reasonCode)) {
      throw serviceError(`reasonCode must be one of: ${VALID_REASON_CODES.join(', ')}`, 400);
    }
    if (reasonCode === 'OTHER' && (!reasonNotes || !reasonNotes.trim())) {
      throw serviceError('reasonNotes is required when reasonCode is OTHER', 400);
    }

    // ── Verify stock exists and belongs to tenant ───────────────────
    const stockItem = await pharmacyRepository.findById(stockId, tenantId);
    if (!stockItem) throw serviceError('Stock item not found', 404);

    // ── Verify available stock is sufficient ────────────────────────
    if (stockItem.totalQuantity < quantityWasted) {
      throw serviceError(
        `Insufficient stock: available ${stockItem.totalQuantity}, requested waste ${quantityWasted}`,
        400
      );
    }

    // ── If batchId provided, verify it belongs to the stockId ───────
    if (batchId) {
      const batch = await pharmacyRepository.findBatchById(batchId, tenantId);
      if (!batch) throw serviceError('Batch not found', 404);
      if (batch.stockId !== stockId) {
        throw serviceError('Batch does not belong to the specified stock item', 400);
      }
    }

    // ── Create the PENDING waste record ─────────────────────────────
    const record = await wasteRepository.create({
      tenantId,
      stockId,
      batchId: batchId || null,
      quantityWasted,
      unit,
      reasonCode,
      reasonNotes: reasonNotes || null,
      initiatedByUserId: user.id,
      initiatedByUserName: user.name
    });

    return record;
  }

  /**
   * Witness confirms a waste record. This is the atomic method.
   * All stock deduction happens inside a single withTransaction call.
   *
   * Flow:
   * 1. Validate record exists, is PENDING, witness differs from initiator
   * 2. Resolve batch (explicit or FEFO)
   * 3. Deduct from PharmacyBatches
   * 4. Deduct from PharmacyStock aggregate
   * 5. Create PharmacyTransactions row (type='waste')
   * 6. Update WasteRecords with witness + transaction link
   * 7. Log to ClinicalChangeLog
   *
   * @param {string} wasteId
   * @param {string} tenantId
   * @param {Object} witnessUser - { id, name, role }
   * @returns {Object} The confirmed waste record
   */
  async confirmWaste(wasteId, tenantId, witnessUser) {
    return await dbAdapter.withTransaction(async (tx) => {
      // 1. Fetch and validate
      const record = await wasteRepository.findById(wasteId, tenantId);
      if (!record) throw serviceError('Waste record not found', 404);
      if (record.status !== 'PENDING') {
        throw serviceError(`Waste record is already ${record.status}`, 409);
      }
      if (witnessUser.id === record.initiatedByUserId) {
        throw serviceError('Witness must be a different staff member from the initiator', 403);
      }

      // 2. Resolve batch — if batchId was specified, use it; otherwise FEFO
      let resolvedBatchId = record.batchId;
      if (!resolvedBatchId) {
        // FEFO: earliest-expiry active batch with sufficient stock
        const fefoCandidate = await pharmacyRepository.getFefoCandidate(record.stockId, tenantId);
        if (!fefoCandidate) {
          throw serviceError('No active batch with available stock found', 400);
        }
        resolvedBatchId = fefoCandidate.id;
      }

      // Verify batch has sufficient quantity
      const batch = await pharmacyRepository.findBatchById(resolvedBatchId, tenantId);
      if (!batch || batch.quantity < record.quantityWasted) {
        throw serviceError(
          `Batch has insufficient quantity (available: ${batch ? batch.quantity : 0}, needed: ${record.quantityWasted})`,
          400
        );
      }

      // 3. Deduct from batch
      const newBatchQty = batch.quantity - record.quantityWasted;
      await pharmacyRepository.updateBatchQuantity(resolvedBatchId, tenantId, newBatchQty, tx);

      // Mark batch as depleted if quantity reaches 0
      if (newBatchQty === 0) {
        await pharmacyRepository.updateBatchStatus(resolvedBatchId, tenantId, 'depleted', tx);
      }

      // 4. Deduct from aggregate PharmacyStock
      // Pattern matches recallBatch in PharmacyService.js (lines 297-304)
      const item = await pharmacyRepository.findById(record.stockId, tenantId);
      const newTotalQuantity = item.totalQuantity - record.quantityWasted;
      const newTotalUnits = Math.floor(Math.max(0, newTotalQuantity) / (item.quantityPerUnit || 1));
      await tx.run(`
        UPDATE PharmacyStock
        SET totalUnits = ?, totalQuantity = ?, lastUpdated = CURRENT_TIMESTAMP
        WHERE id = ? AND tenantId = ?
      `, [newTotalUnits, newTotalQuantity, record.stockId, tenantId]);

      // 5. Create PharmacyTransactions row
      const txnId = crypto.randomUUID();
      await pharmacyRepository.recordTransaction({
        id: txnId,
        tenantId,
        medicationId: record.stockId,
        type: 'waste',
        quantity: -record.quantityWasted,
        userId: witnessUser.id,
        userName: witnessUser.name,
        notes: `WASTE [${record.reasonCode}]: ${record.quantityWasted} ${record.unit}. Batch: ${batch.batchNumber} (batchId:${resolvedBatchId}). Reason: ${record.reasonNotes || record.reasonCode}. Initiated by: ${record.initiatedByUserName}. Witness: ${witnessUser.name}.`
      }, tx);

      // 6. Update waste record with witness and transaction link
      // Also write back resolved batchId if it was auto-selected via FEFO
      if (!record.batchId) {
        await tx.run(`UPDATE WasteRecords SET batchId = ? WHERE id = ? AND tenantId = ?`,
          [resolvedBatchId, wasteId, tenantId]);
      }

      await wasteRepository.confirmWaste(wasteId, tenantId, {
        witnessUserId: witnessUser.id,
        witnessUserName: witnessUser.name,
        pharmacyTransactionId: txnId
      }, tx);

      // 7. Log to ClinicalChangeLog
      await tx.run(`
        INSERT INTO ClinicalChangeLog (id, tenantId, userId, userRole, entityType, entityId, action, summary, timestamp)
        VALUES (?, ?, ?, ?, 'WasteRecord', ?, 'CONFIRMED', ?, CURRENT_TIMESTAMP)
      `, [
        crypto.randomUUID(),
        tenantId,
        witnessUser.id,
        witnessUser.role || 'unknown',
        wasteId,
        `Waste confirmed: ${record.quantityWasted} ${record.unit} of ${record.stockName || record.stockId} [${record.reasonCode}]. Initiated by ${record.initiatedByUserName}, witnessed by ${witnessUser.name}.`
      ]);

      return {
        id: wasteId,
        status: 'CONFIRMED',
        stockName: record.stockName,
        quantityWasted: record.quantityWasted,
        unit: record.unit,
        reasonCode: record.reasonCode,
        batchId: resolvedBatchId,
        batchNumber: batch.batchNumber,
        pharmacyTransactionId: txnId,
        witnessUserId: witnessUser.id,
        witnessUserName: witnessUser.name
      };
    });
  }

  /**
   * Cancel a PENDING waste record. Only the initiator or an admin can cancel.
   * No stock changes.
   *
   * @param {string} wasteId
   * @param {string} tenantId
   * @param {Object} user - Requesting user
   */
  async cancelWaste(wasteId, tenantId, user) {
    const record = await wasteRepository.findById(wasteId, tenantId);
    if (!record) throw serviceError('Waste record not found', 404);
    if (record.status !== 'PENDING') {
      throw serviceError(`Cannot cancel: record is already ${record.status}`, 409);
    }
    if (user.id !== record.initiatedByUserId && user.role !== 'admin') {
      throw serviceError('Only the initiator or an admin can cancel this waste record', 403);
    }

    await wasteRepository.cancelWaste(wasteId, tenantId);

    return { id: wasteId, status: 'CANCELLED' };
  }

  /**
   * List all PENDING waste records for the witness dashboard.
   */
  async listPending(tenantId) {
    return await wasteRepository.findPendingByTenant(tenantId);
  }

  /**
   * Paginated list of all waste records (all statuses).
   */
  async listAll(tenantId, limit, cursor) {
    return await wasteRepository.findAllByTenant(tenantId, limit, cursor);
  }
}

module.exports = new WasteService();
