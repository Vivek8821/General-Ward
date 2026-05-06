const request = require('supertest');
const express = require('express');
const { initDb, db } = require('../../db');
const barcodeRoutes = require('../../controllers/BarcodeController');
const pharmacyRoutes = require('../../controllers/PharmacyController');
const jwt = require('jsonwebtoken');
const config = require('../../config');

describe('Barcode & QR Integration', () => {
  let app;
  const tenantId = 'test-tenant-' + Date.now();
  const userId = 'user-' + Date.now();
  const token = jwt.sign({ id: userId, role: 'doctor', tenantId }, config.jwtSecret);
  const barcodePrefix = 'BC' + Date.now();

  beforeAll(async () => {
    await initDb();
    app = express();
    app.use(express.json());
    app.use('/api/pharmacy', pharmacyRoutes);
    app.use('/api/pharmacy/barcodes', barcodeRoutes);
    
    // Cleanup any existing data for this tenant (should be empty but just in case)
    await new Promise((resolve) => {
      db.run(`DELETE FROM PharmacyStock WHERE tenantId = ?`, [tenantId], () => {
        db.run(`DELETE FROM PharmacyBatches WHERE tenantId = ?`, [tenantId], () => {
          db.run(`DELETE FROM BarcodeRegistrations WHERE tenantId = ?`, [tenantId], resolve);
        });
      });
    });
  });


  afterAll(done => {
    db.close(done);
  });

  let stockId;
  let batchId;

  it('should create a stock record and register a barcode', async () => {
    // 1. Create Stock
    const stockRes = await request(app)
      .post('/api/pharmacy/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Drug',
        composition: 'Test Comp',
        type: 'Tablet',
        category: 'Test',
        quantityPerUnit: 10,
        totalUnits: 0,
        unit: 'Strips',
        itemUnit: 'Tabs',
        costPerUnit: 5,
        manufacturer: 'Test Lab'
      });
    
    expect(stockRes.status).toBe(201);
    stockId = stockRes.body.id;

    // 2. Register Barcode
    const regRes = await request(app)
      .post('/api/pharmacy/barcodes/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        barcode: barcodePrefix + '001',
        targetType: 'STOCK',
        targetId: stockId,
        notes: 'Test note'
      });
    
    expect(regRes.status).toBe(201);
  });

  it('should resolve a stock-level barcode scan', async () => {
    const res = await request(app)
      .get(`/api/pharmacy/barcodes/scan/${barcodePrefix}001`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.matchType).toBe('STOCK');
    expect(res.body.record.name).toBe('Test Drug');
  });

  it('should register and resolve a batch-level barcode (priority)', async () => {
    // 1. Add Batch
    const batchRes = await request(app)
      .post(`/api/pharmacy/inventory/${stockId}/batches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        batchNumber: 'BATCH-001',
        expiryDate: '2026-12-31',
        quantity: 100,
        costPerUnit: 5
      });
    
    expect(batchRes.status).toBe(201);
    batchId = batchRes.body.batchId;

    // 2. Register Batch Barcode
    await request(app)
      .post('/api/pharmacy/barcodes/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        barcode: barcodePrefix + '999',
        targetType: 'BATCH',
        targetId: batchId
      });

    // 3. Resolve Batch Barcode
    const res = await request(app)
      .get(`/api/pharmacy/barcodes/scan/${barcodePrefix}999`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.matchType).toBe('BATCH');
    expect(res.body.record.batchNumber).toBe('BATCH-001');
  });

  it('should block duplicate barcode registration in same tenant', async () => {
    const res = await request(app)
      .post('/api/pharmacy/barcodes/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        barcode: barcodePrefix + '001',
        targetType: 'STOCK',
        targetId: 'something-else'
      });
    
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already registered');
  });

  it('should parse GS1-128 and return UNREGISTERED for new codes', async () => {
    const gs1Code = '01089012345678901726123110LOT777';
    const res = await request(app)
      .get(`/api/pharmacy/barcodes/scan/${gs1Code}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UNREGISTERED');
    expect(res.body.parsedFields.format).toBe('GS1_128');
    expect(res.body.parsedFields.gtin).toBe('08901234567890');
    expect(res.body.parsedFields.lotNumber).toBe('LOT777');
  });

  it('should generate a QR code data URI', async () => {
    const res = await request(app)
      .get(`/api/pharmacy/barcodes/qr/${stockId}?name=Test%20Drug`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.qrDataUri).toContain('data:image/png;base64');
  });
});
