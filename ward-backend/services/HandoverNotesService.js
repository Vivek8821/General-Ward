const crypto = require('crypto');
const handoverNotesRepository = require('../repositories/HandoverNotesRepository');

const ALLOWED_SHIFTS = ['morning', 'afternoon', 'night'];

class HandoverNotesService {
  async createNote(patientId, payload, createdBy) {
    if (!patientId) throw new Error('Patient ID is required');
    const { shift, note, tags } = payload || {};

    if (!shift || !ALLOWED_SHIFTS.includes(shift)) {
      throw new Error('Invalid shift');
    }
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      throw new Error('Note is required');
    }

    const id = crypto.randomUUID();
    return await handoverNotesRepository.create({
      id,
      patientId,
      shift,
      note,
      tags: tags ? String(tags).trim() : null,
      createdBy
    });
  }

  async listNotes(patientId, query) {
    if (!patientId) throw new Error('Patient ID is required');
    const { shift, from, to, limit } = query || {};

    return await handoverNotesRepository.listByPatient(patientId, {
      shift: shift && ALLOWED_SHIFTS.includes(shift) ? shift : null,
      from: from || null,
      to: to || null,
      limit: limit ? Math.max(1, Math.min(200, Number(limit))) : 50
    });
  }
}

module.exports = new HandoverNotesService();

