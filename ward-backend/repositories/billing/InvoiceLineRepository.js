const dbAdapter = require('../../db-adapter');
const invoiceRepo = require('./InvoiceRepository');

class InvoiceLineRepository {
  async listByInvoice(invoiceId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM InvoiceLines WHERE invoiceId = ? AND tenantId = ? ORDER BY createdAt ASC`,
      [invoiceId, tenantId]
    );
  }

  async findById(id, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM InvoiceLines WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async _assertInvoiceOpenInTx({ getAsync }, invoiceId, tenantId) {
    const inv = await getAsync(
      `SELECT status FROM Invoices WHERE id = ? AND tenantId = ?`,
      [invoiceId, tenantId]
    );
    if (!inv) throw new Error('Invoice not found');
    if (inv.status !== 'open') throw new Error(`Cannot modify lines on invoice in status '${inv.status}'`);
  }

  // Add a line. If sourceRef is set and a line with the same (tenantId, source, sourceRef)
  // already exists, this returns the existing line (idempotent for auto-charges).
  async create({ id, tenantId, invoiceId, source, sourceRef, description, quantity, unitPrice }) {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const lineTotal = Number((qty * price).toFixed(2));

    return dbAdapter.withTransaction(async (tx) => {
      await this._assertInvoiceOpenInTx(tx, invoiceId, tenantId);

      if (sourceRef) {
        const existing = await tx.getAsync(
          `SELECT * FROM InvoiceLines WHERE tenantId = ? AND source = ? AND sourceRef = ?`,
          [tenantId, source, sourceRef]
        );
        if (existing) return existing;
      }

      await tx.runAsync(
        `INSERT INTO InvoiceLines (id, tenantId, invoiceId, source, sourceRef, description, quantity, unitPrice, lineTotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, invoiceId, source, sourceRef ?? null, description, qty, price, lineTotal]
      );
      await invoiceRepo._recomputeTotalsInTx(tx, invoiceId, tenantId);
      return tx.getAsync(`SELECT * FROM InvoiceLines WHERE id = ?`, [id]);
    });
  }

  async delete(lineId, tenantId) {
    return dbAdapter.withTransaction(async (tx) => {
      const line = await tx.getAsync(
        `SELECT invoiceId FROM InvoiceLines WHERE id = ? AND tenantId = ?`,
        [lineId, tenantId]
      );
      if (!line) throw new Error('Line not found');
      await this._assertInvoiceOpenInTx(tx, line.invoiceId, tenantId);
      await tx.runAsync(
        `DELETE FROM InvoiceLines WHERE id = ? AND tenantId = ?`,
        [lineId, tenantId]
      );
      await invoiceRepo._recomputeTotalsInTx(tx, line.invoiceId, tenantId);
      return { deleted: true };
    });
  }
}

module.exports = new InvoiceLineRepository();
