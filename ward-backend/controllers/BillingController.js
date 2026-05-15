const express = require('express');
const crypto = require('crypto');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middleware/protect');
const { clinicalWriteLimiter, adminWriteLimiter } = require('../middleware/rateLimiters');
const invoiceRepo = require('../repositories/billing/InvoiceRepository');
const lineRepo = require('../repositories/billing/InvoiceLineRepository');
const paymentRepo = require('../repositories/billing/PaymentRepository');
const serviceRepo = require('../repositories/billing/ServiceCatalogRepository');
const { safeAccrueForPatient } = require('../services/billing/AccrualService');

const isReader = (req) => ['admin', 'doctor', 'nurse'].includes(req.user?.role);
const isWriter = (req) => ['admin', 'doctor'].includes(req.user?.role);
const isAdmin  = (req) => req.user?.role === 'admin';

// ── Service catalog ──────────────────────────────────────────────────────────

router.get('/services',
  protect(isReader, { resource: 'billing.service' }),
  async (req, res, next) => {
    try {
      const services = await serviceRepo.findAll(req.tenantId, { category: req.query.category });
      res.json({ data: services });
    } catch (err) { next(err); }
  }
);

router.post('/services',
  adminWriteLimiter,
  protect(isAdmin, { resource: 'billing.service' }),
  async (req, res, next) => {
    try {
      const { code, name, description, category, unitPrice } = req.body || {};
      if (!code || !name || !category || unitPrice == null) {
        return res.status(400).json({ error: 'code, name, category, unitPrice required' });
      }
      const id = crypto.randomUUID();
      await serviceRepo.create({ id, tenantId: req.tenantId, code, name, description, category, unitPrice: Number(unitPrice) });
      res.status(201).json(await serviceRepo.findById(id, req.tenantId));
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) return res.status(409).json({ error: 'Service code already exists' });
      next(err);
    }
  }
);

router.put('/services/:id',
  adminWriteLimiter,
  protect(isAdmin, { resource: 'billing.service' }),
  async (req, res, next) => {
    try {
      await serviceRepo.update(req.params.id, req.tenantId, req.body || {});
      const svc = await serviceRepo.findById(req.params.id, req.tenantId);
      if (!svc) return res.status(404).json({ error: 'Service not found' });
      res.json(svc);
    } catch (err) { next(err); }
  }
);

// ── Invoices ─────────────────────────────────────────────────────────────────

router.get('/patients/:patientId/invoices',
  protect(isReader, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      await safeAccrueForPatient(req.params.patientId, req.tenantId);
      const invoices = await invoiceRepo.listByPatient(req.params.patientId, req.tenantId);
      res.json({ data: invoices });
    } catch (err) { next(err); }
  }
);

router.post('/patients/:patientId/invoices',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      const id = crypto.randomUUID();
      await invoiceRepo.create({
        id,
        tenantId: req.tenantId,
        patientId: req.params.patientId,
        createdBy: req.user.id,
        notes: req.body?.notes,
      });
      res.status(201).json(await invoiceRepo.findWithDetails(id, req.tenantId));
    } catch (err) { next(err); }
  }
);

router.get('/invoices/:id',
  protect(isReader, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      const first = await invoiceRepo.findById(req.params.id, req.tenantId);
      if (!first) return res.status(404).json({ error: 'Invoice not found' });
      if (first.status === 'open') {
        await safeAccrueForPatient(first.patientId, req.tenantId);
      }
      const invoice = await invoiceRepo.findWithDetails(req.params.id, req.tenantId);
      res.json(invoice);
    } catch (err) { next(err); }
  }
);

router.post('/invoices/:id/lines',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.line' }),
  async (req, res, next) => {
    try {
      const { description, quantity, unitPrice, source = 'manual', sourceRef } = req.body || {};
      if (!description || quantity == null || unitPrice == null) {
        return res.status(400).json({ error: 'description, quantity, unitPrice required' });
      }
      const id = crypto.randomUUID();
      const line = await lineRepo.create({
        id,
        tenantId: req.tenantId,
        invoiceId: req.params.id,
        source,
        sourceRef,
        description,
        quantity,
        unitPrice,
      });
      res.status(201).json(line);
    } catch (err) {
      if (/Invoice not found/.test(err.message)) return res.status(404).json({ error: err.message });
      if (/Cannot modify/.test(err.message))    return res.status(409).json({ error: err.message });
      next(err);
    }
  }
);

router.delete('/invoices/:id/lines/:lineId',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.line' }),
  async (req, res, next) => {
    try {
      await lineRepo.delete(req.params.lineId, req.tenantId);
      res.json({ ok: true });
    } catch (err) {
      if (/not found/i.test(err.message)) return res.status(404).json({ error: err.message });
      if (/Cannot modify/.test(err.message)) return res.status(409).json({ error: err.message });
      next(err);
    }
  }
);

router.put('/invoices/:id/discount',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      const discount = Number(req.body?.discountTotal);
      if (!(discount >= 0)) return res.status(400).json({ error: 'discountTotal must be non-negative' });
      const totals = await invoiceRepo.setDiscount(req.params.id, req.tenantId, discount);
      res.json(totals);
    } catch (err) { next(err); }
  }
);

router.post('/invoices/:id/finalize',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      const totals = await invoiceRepo.finalize(req.params.id, req.tenantId);
      res.json(totals);
    } catch (err) {
      if (/not found/i.test(err.message)) return res.status(404).json({ error: err.message });
      if (/Cannot finalize/.test(err.message)) return res.status(409).json({ error: err.message });
      next(err);
    }
  }
);

router.post('/invoices/:id/cancel',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.invoice' }),
  async (req, res, next) => {
    try {
      const result = await invoiceRepo.cancel(req.params.id, req.tenantId);
      res.json(result);
    } catch (err) {
      if (/not found/i.test(err.message)) return res.status(404).json({ error: err.message });
      if (/Cannot cancel/.test(err.message)) return res.status(409).json({ error: err.message });
      next(err);
    }
  }
);

// ── Payments ─────────────────────────────────────────────────────────────────

router.post('/invoices/:id/payments',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.payment' }),
  async (req, res, next) => {
    try {
      const { method, amount, reference } = req.body || {};
      if (!method || amount == null) {
        return res.status(400).json({ error: 'method, amount required' });
      }
      const id = crypto.randomUUID();
      const payment = await paymentRepo.record({
        id,
        tenantId: req.tenantId,
        invoiceId: req.params.id,
        method,
        amount,
        reference,
        recordedBy: req.user.id,
      });
      res.status(201).json(payment);
    } catch (err) {
      if (/Invoice not found/.test(err.message)) return res.status(404).json({ error: err.message });
      if (/positive|cancelled/i.test(err.message)) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

router.post('/invoices/:id/payments/:paymentId/refund',
  clinicalWriteLimiter,
  protect(isWriter, { resource: 'billing.payment' }),
  async (req, res, next) => {
    try {
      const result = await paymentRepo.refund(req.params.paymentId, req.tenantId);
      res.json(result);
    } catch (err) {
      if (/not found/i.test(err.message)) return res.status(404).json({ error: err.message });
      next(err);
    }
  }
);

module.exports = router;
