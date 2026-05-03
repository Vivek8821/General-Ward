const barcodeRepository = require('../repositories/BarcodeRepository');
const gs1Parser = require('../utils/gs1Parser');
const QRCode = require('qrcode');
const crypto = require('crypto');

class BarcodeService {
  async resolveScan(tenantId, rawBarcode) {
    if (!rawBarcode || rawBarcode.trim().length === 0) {
      throw new Error('Empty barcode provided');
    }

    const trimmed = rawBarcode.trim();
    const parsedFields = gs1Parser.parseBarcode(trimmed);

    const match = await barcodeRepository.resolveByBarcode(tenantId, trimmed);
    if (match) {
      return {
        status: 'RESOLVED',
        matchType: match.matchType,
        record: match.data,
        parsedFields
      };
    }

    return {
      status: 'UNREGISTERED',
      parsedFields
    };
  }

  async registerBarcode(tenantId, payload, requestingUser) {
    const { barcode, targetType, targetId, notes } = payload;

    if (!barcode || !targetType || !targetId) {
      throw new Error('Barcode, targetType, and targetId are required');
    }

    const trimmed = barcode.trim();
    const conflict = await barcodeRepository.findConflict(trimmed);

    if (conflict) {
      if (conflict.tenantId === tenantId) {
        throw new Error(`This barcode is already registered to ${conflict.name}. Remove the existing registration before reassigning.`);
      } else {
        // Cross-tenant conflict: just a warning (log it)
        console.warn(`[BarcodeService] Cross-tenant conflict: barcode ${trimmed} registered to ${conflict.name} in tenant ${conflict.tenantId}`);
      }
    }

    if (targetType === 'STOCK') {
      await barcodeRepository.registerStockBarcode(tenantId, targetId, trimmed, requestingUser.id, notes);
    } else if (targetType === 'BATCH') {
      await barcodeRepository.registerBatchBarcode(tenantId, targetId, trimmed, requestingUser.id, notes);
    } else {
      throw new Error('Invalid targetType');
    }

    return { success: true };
  }

  async generateQRCode(tenantId, stockId, drugName) {
    // We encode a unique structure that our scanner can recognize as an internal shelf label
    const payload = JSON.stringify({
      v: '1',
      t: tenantId,
      s: stockId,
      n: drugName,
      r: crypto.randomBytes(4).toString('hex') // prevent static URL pattern guessing if it were a URL
    });

    try {
      const qrDataUri = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 4,
        scale: 4
      });
      return { qrDataUri };
    } catch (err) {
      console.error('[BarcodeService] QR Generation failed:', err);
      throw new Error('Failed to generate QR code');
    }
  }

  async getHistory(tenantId, barcode) {
    return barcodeRepository.getRegistrationHistory(tenantId, barcode.trim());
  }
}

module.exports = new BarcodeService();
