const dbAdapter = require('../../db-adapter');

// Money invariants enforced here, in the repository, so callers cannot drift them:
//   subtotal     = sum(lineTotal)
//   grandTotal   = subtotal - discountTotal + taxTotal
//   paidTotal    = sum(payments where status in ('recorded','captured'))
//   balanceDue   = grandTotal - paidTotal
//   status flips to 'paid' when finalized AND balanceDue <= 0.
class InvoiceRepository {
  async findById(id, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM Invoices WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async findWithDetails(id, tenantId) {
    const invoice = await this.findById(id, tenantId);
    if (!invoice) return null;
    const [lines, payments] = await Promise.all([
      dbAdapter.all(
        `SELECT * FROM InvoiceLines WHERE invoiceId = ? AND tenantId = ? ORDER BY createdAt ASC`,
        [id, tenantId]
      ),
      dbAdapter.all(
        `SELECT * FROM Payments WHERE invoiceId = ? AND tenantId = ? ORDER BY createdAt ASC`,
        [id, tenantId]
      ),
    ]);
    return { ...invoice, lines, payments };
  }

  async listByPatient(patientId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM Invoices WHERE patientId = ? AND tenantId = ? ORDER BY createdAt DESC`,
      [patientId, tenantId]
    );
  }

  async findOpenForPatient(patientId, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM Invoices WHERE patientId = ? AND tenantId = ? AND status = 'open' ORDER BY createdAt DESC LIMIT 1`,
      [patientId, tenantId]
    );
  }

  async create({ id, tenantId, patientId, createdBy, notes }) {
    await dbAdapter.run(
      `INSERT INTO Invoices (id, tenantId, patientId, status, createdBy, notes)
       VALUES (?, ?, ?, 'open', ?, ?)`,
      [id, tenantId, patientId, createdBy, notes ?? null]
    );
    return id;
  }

  // Recompute totals from lines + payments. Call inside a transaction.
  async _recomputeTotalsInTx({ getAsync, runAsync }, invoiceId, tenantId) {
    const subRow = await getAsync(
      `SELECT COALESCE(SUM(lineTotal), 0) AS subtotal FROM InvoiceLines WHERE invoiceId = ? AND tenantId = ?`,
      [invoiceId, tenantId]
    );
    const payRow = await getAsync(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM Payments
       WHERE invoiceId = ? AND tenantId = ? AND status IN ('recorded','captured')`,
      [invoiceId, tenantId]
    );
    const invoice = await getAsync(
      `SELECT discountTotal, taxTotal, status FROM Invoices WHERE id = ? AND tenantId = ?`,
      [invoiceId, tenantId]
    );
    if (!invoice) throw new Error('Invoice not found');

    const subtotal = Number(subRow.subtotal) || 0;
    const paid = Number(payRow.paid) || 0;
    const discount = Number(invoice.discountTotal) || 0;
    const tax = Number(invoice.taxTotal) || 0;
    const grand = subtotal - discount + tax;
    const balance = grand - paid;

    let newStatus = invoice.status;
    let paidAt = null;
    if (invoice.status === 'finalized' && balance <= 0) {
      newStatus = 'paid';
      paidAt = new Date().toISOString();
    }

    await runAsync(
      `UPDATE Invoices
       SET subtotal = ?, grandTotal = ?, paidTotal = ?, balanceDue = ?, status = ?,
           paidAt = COALESCE(?, paidAt)
       WHERE id = ? AND tenantId = ?`,
      [subtotal, grand, paid, balance, newStatus, paidAt, invoiceId, tenantId]
    );

    return { subtotal, grandTotal: grand, paidTotal: paid, balanceDue: balance, status: newStatus };
  }

  async recomputeTotals(invoiceId, tenantId) {
    return dbAdapter.withTransaction(async (tx) => this._recomputeTotalsInTx(tx, invoiceId, tenantId));
  }

  async setDiscount(invoiceId, tenantId, discountTotal) {
    return dbAdapter.withTransaction(async (tx) => {
      await tx.runAsync(
        `UPDATE Invoices SET discountTotal = ? WHERE id = ? AND tenantId = ? AND status = 'open'`,
        [discountTotal, invoiceId, tenantId]
      );
      return this._recomputeTotalsInTx(tx, invoiceId, tenantId);
    });
  }

  async finalize(invoiceId, tenantId) {
    return dbAdapter.withTransaction(async (tx) => {
      const inv = await tx.getAsync(
        `SELECT status FROM Invoices WHERE id = ? AND tenantId = ?`,
        [invoiceId, tenantId]
      );
      if (!inv) throw new Error('Invoice not found');
      if (inv.status !== 'open') throw new Error(`Cannot finalize invoice in status '${inv.status}'`);
      await tx.runAsync(
        `UPDATE Invoices SET status = 'finalized', finalizedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?`,
        [invoiceId, tenantId]
      );
      return this._recomputeTotalsInTx(tx, invoiceId, tenantId);
    });
  }

  async cancel(invoiceId, tenantId) {
    return dbAdapter.withTransaction(async (tx) => {
      const inv = await tx.getAsync(
        `SELECT status FROM Invoices WHERE id = ? AND tenantId = ?`,
        [invoiceId, tenantId]
      );
      if (!inv) throw new Error('Invoice not found');
      if (inv.status === 'paid') throw new Error('Cannot cancel a paid invoice');
      await tx.runAsync(
        `UPDATE Invoices SET status = 'cancelled' WHERE id = ? AND tenantId = ?`,
        [invoiceId, tenantId]
      );
      return { status: 'cancelled' };
    });
  }
}

module.exports = new InvoiceRepository();
