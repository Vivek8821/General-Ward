/**
 * GS1-128 and Pharmaceutical Barcode Parser
 * 
 * Attempts to extract structured data from clinical barcodes.
 * Supports:
 * - GS1-128 (GTIN, Expiry, Lot, Serial)
 * - EAN-13 (Standard retail barcodes)
 * - QR URLs
 */

/**
 * Parses a raw barcode string into a structured object.
 * @param {string} rawString The raw text scanned from the barcode.
 * @returns {Object} Structured data object.
 */
function parseBarcode(rawString) {
  if (!rawString || typeof rawString !== 'string') {
    return createEmptyResult(rawString);
  }

  const trimmed = rawString.trim();
  if (trimmed.length === 0) {
    return createEmptyResult(rawString);
  }

  // 1. Detect QR URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      raw: trimmed,
      format: 'QR_URL',
      gtin: null,
      expiryDate: null,
      lotNumber: null,
      serialNumber: null
    };
  }

  // 2. Detect EAN-13 (13 digits)
  if (/^\d{13}$/.test(trimmed)) {
    return {
      raw: trimmed,
      format: 'EAN13',
      gtin: '0' + trimmed, // Pad to 14-digit GTIN
      expiryDate: null,
      lotNumber: null,
      serialNumber: null
    };
  }

  // 3. Detect GS1-128 (Structured Application Identifiers)
  // We look for common AI prefixes: 
  // (01) GTIN - 14 digits
  // (17) Expiry - 6 digits (YYMMDD)
  // (10) Lot/Batch - Variable
  // (21) Serial - Variable
  
  // Scanners often strip parentheses. We look for both formats.
  const hasAIs = trimmed.includes('(01)') || trimmed.includes('(17)') || trimmed.includes('(10)') ||
                 /^(01|17|10|21)/.test(trimmed);

  if (hasAIs) {
    return parseGS1128(trimmed);
  }

  return createEmptyResult(trimmed);
}

function parseGS1128(str) {
  const result = {
    raw: str,
    format: 'GS1_128',
    gtin: null,
    expiryDate: null,
    lotNumber: null,
    serialNumber: null
  };

  // Standard AIs and their fixed lengths (including AI prefix length)
  // AI 01: GTIN (2 + 14 = 16)
  // AI 17: Expiry (2 + 6 = 8)
  // AI 10: Lot (2 + variable up to 20)
  // AI 21: Serial (2 + variable up to 20)

  let flat = str.replace(/\(|\)/g, '');
  
  // Sequential parsing strategy
  let i = 0;
  while (i < flat.length) {
    const ai2 = flat.substring(i, i + 2);
    
    if (ai2 === '01') {
      result.gtin = flat.substring(i + 2, i + 16);
      i += 16;
    } else if (ai2 === '17') {
      const dateStr = flat.substring(i + 2, i + 8);
      if (dateStr.length === 6) {
        const yy = dateStr.substring(0, 2);
        const mm = dateStr.substring(2, 4);
        const dd = dateStr.substring(4, 6);
        const year = parseInt(yy) + 2000;
        const month = parseInt(mm);
        const day = parseInt(dd);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          result.expiryDate = `${year}-${mm}-${dd}`;
        }
      }
      i += 8;
    } else if (ai2 === '10') {
      // Lot is variable length. It continues until the end or another AI.
      // In real GS1-128, a FNC1 character separates variable fields.
      // Here we greedily take until the next AI prefix we recognize or end of string.
      let lotData = '';
      i += 2;
      while (i < flat.length) {
        // If we hit something that looks like AI 17 or AI 21 at a plausible boundary, we might stop.
        // But usually Lot is the last field or followed by Serial.
        // For now, we'll look for '17' or '21' as markers if they are 2 chars long.
        if (flat.substring(i, i+2) === '17' && (flat.length - i) >= 8) break;
        if (flat.substring(i, i+2) === '21') break;
        lotData += flat[i];
        i++;
      }
      result.lotNumber = lotData.substring(0, 20);
    } else if (ai2 === '21') {
      let serialData = '';
      i += 2;
      while (i < flat.length) {
        if (flat.substring(i, i+2) === '17' && (flat.length - i) >= 8) break;
        if (flat.substring(i, i+2) === '10') break;
        serialData += flat[i];
        i++;
      }
      result.serialNumber = serialData.substring(0, 20);
    } else {
      // Unrecognized AI, skip one char to try to re-align (though GS1 shouldn't be like this)
      i++;
    }
  }

  return result;
}


function createEmptyResult(raw) {
  return {
    raw: raw || '',
    format: 'UNKNOWN',
    gtin: null,
    expiryDate: null,
    lotNumber: null,
    serialNumber: null
  };
}

module.exports = { parseBarcode };
