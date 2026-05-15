const dbAdapter = require('../../db-adapter');
const invoiceRepo = require('./InvoiceRepository');

class PaymentRepository {
  async findById(id, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM Payments WHERE id = ? AND tenantId = ?`,
      [id, tenantId]
    );
  }

  async findByReference(reference, tenantId) {
    return dbAdapter.get(
      `SELECT * FROM Payments WHERE reference = ? AND tenantId = ?`,
      [reference, tenantId]
    );
  }

  async listByInvoice(invoiceId, tenantId) {
    return dbAdapter.all(
      `SELECT * FROM Payments WHERE invoiceId = ? AND tenantId = ? ORDER BY createdAt ASC`,
      [invoiceId, tenantId]
    );
  }

  async record({ id, tenantId, invoiceId, method, amount, reference, recordedBy, status = 'recorded' }) {
    const amt = Number(amount);
    if (!(amt > 0)) throw new Error('Payment amount must be positive');

    return dbAdapter.withTransaction(async (tx) => {
      const inv = await tx.getAsync(
        `SELECT status, balanceDue FROM Invoices WHERE id = ? AND tenantId = ?`,
        [invoiceId, tenantId]
      );
      if (!inv) throw new Error('Invoice not found');
      if (inv.status === 'cancelled') throw new Error('Cannot record payment on cancelled invoice');

      const capturedAt = (status === 'captured' || status === 'recorded') ? new Date().toISOString() : null;

      await tx.runAsync(
        `INSERT INTO Payments (id, tenantId, invoiceId, method, amount, reference, status, capturedAt, recordedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, invoiceId, method, amt, reference ?? null, status, capturedAt, recordedBy]
      );
      await invoiceRepo._recomputeTotalsInTx(tx, invoiceId, tenantId);
      return tx.getAsync(`SELECT * FROM Payments WHERE id = ?`, [id]);
    });
  }

  // Razorpay webhook path: flip a pending payment to captured once the gateway confirms.
  async markCaptured(paymentId, tenantId, { reference } = {}) {
    return dbAdapter.withTransaction(async (tx) => {
      const pay = await tx.getAsync(
        `SELECT invoiceId, status FROM Payments WHERE id = ? AND tenantId = ?`,
        [paymentId, tenantId]
      );
      if (!pay) throw new Error('Payment not found');
      if (pay.status === 'captured') return { invoiceId: pay.invoiceId, alreadyCaptured: true };
      if (pay.status === 'refunded') throw new Error('Cannot capture a refunded payment');

      await tx.runAsync(
        `UPDATE Payments SET status = 'captured', capturedAt = CURRENT_TIMESTAMP, reference = COALESCE(?, reference)
         WHERE id = ? AND tenantId = ?`,
        [reference ?? null, paymentId, tenantId]
      );
      await invoiceRepo._recomputeTotalsInTx(tx, pay.invoiceId, tenantId);
      return { invoiceId: pay.invoiceId, alreadyCaptured: false };
    });
  }

  async refund(paymentId, tenantId) {
    return dbAdapter.withTransaction(async (tx) => {
      const pay = await tx.getAsync(
        `SELECT invoiceId, status FROM Payments WHERE id = ? AND tenantId = ?`,
        [paymentId, tenantId]
      );
      if (!pay) throw new Error('Payment not found');
      if (pay.status === 'refunded') return { invoiceId: pay.invoiceId, alreadyRefunded: true };

      await tx.runAsync(
        `UPDATE Payments SET status = 'refunded', refundedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?`,
        [paymentId, tenantId]
      );
      await invoiceRepo._recomputeTotalsInTx(tx, pay.invoiceId, tenantId);
      return { invoiceId: pay.invoiceId, alreadyRefunded: false };
    });
  }
}

module.exports = new PaymentRepository();
