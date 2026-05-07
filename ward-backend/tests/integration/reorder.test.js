const request = require('supertest');
const { app } = require('../../server');
const { initDb } = require('../../db');
const dbAdapter = require('../../db-adapter');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../middleware/auth');

describe('Pharmacy Automated Reorder Integration', () => {
  const tenantId = 'tenant-reorder-test';
  const doctor = { id: 'admin1', name: 'Admin Reorder', role: 'pharmacist', tenantId };
  const token = jwt.sign(doctor, JWT_SECRET);
  let stockId;

  beforeAll(async () => {
    await initDb();
    // Ensure tenant exists
    await dbAdapter.run('INSERT OR IGNORE INTO Tenants (id, name) VALUES (?, ?)', [tenantId, 'Reorder Test Tenant']);
    
    // Create a medication just above threshold
    stockId = crypto.randomUUID();
    await dbAdapter.run(`
      INSERT INTO PharmacyStock (id, tenantId, name, composition, minThreshold, totalQuantity, totalUnits, quantityPerUnit)
      VALUES (?, ?, 'ReorderTestMed', 'Test 10mg', 10, 15, 15, 1)
    `, [stockId, tenantId]);

    // Add a batch for FEFO
    await dbAdapter.run(`
      INSERT INTO PharmacyBatches (id, tenantId, stockId, batchNumber, expiryDate, quantity, status)
      VALUES (?, ?, ?, 'LOT-REORDER', '2030-01-01', 15, 'active')
    `, [crypto.randomUUID(), tenantId, stockId]);
  });

  afterAll(async () => {
    await dbAdapter.run('DELETE FROM PurchaseOrders WHERE tenantId = ?', [tenantId]);
    await dbAdapter.run('DELETE FROM PharmacyTransactions WHERE tenantId = ?', [tenantId]);
    await dbAdapter.run('DELETE FROM PharmacyBatches WHERE tenantId = ?', [tenantId]);
    await dbAdapter.run('DELETE FROM PharmacyStock WHERE tenantId = ?', [tenantId]);
  });

  it('should automatically generate a PO when stock falls below threshold', async () => {
    // 1. Verify no PO exists initially
    const initialOrders = await request(app)
      .get('/api/pharmacy/orders')
      .set('Authorization', `Bearer ${token}`);
    
    const relevantOrders = initialOrders.body.filter(o => o.stockId === stockId);
    expect(relevantOrders.length).toBe(0);

    // 2. Adjust stock level to 9 (15 -> 9), crossing the threshold of 10
    const dispenseRes = await request(app)
      .patch(`/api/pharmacy/inventory/${stockId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totalUnits: 9, notes: 'Trigger reorder' });
    
    expect(dispenseRes.status).toBe(200);

    // Wait a short moment for the fire-and-forget reorder check to finish
    await new Promise(r => setTimeout(r, 200));

    // 3. Verify PO was created
    const afterOrders = await request(app)
      .get('/api/pharmacy/orders')
      .set('Authorization', `Bearer ${token}`);
    
    const newOrders = afterOrders.body.filter(o => o.stockId === stockId);
    expect(newOrders.length).toBe(1);
    expect(newOrders[0].status).toBe('pending');
    expect(newOrders[0].quantity).toBeGreaterThan(0);
  });

  it('should not generate a duplicate PO if one is already pending', async () => {
    // 1. Adjust stock level to 8 (9 -> 8)
    const dispenseRes = await request(app)
      .patch(`/api/pharmacy/inventory/${stockId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totalUnits: 8, notes: 'Check duplicate reorder' });
    
    expect(dispenseRes.status).toBe(200);

    await new Promise(r => setTimeout(r, 200));

    // 2. Verify still only 1 PO exists
    const finalOrders = await request(app)
      .get('/api/pharmacy/orders')
      .set('Authorization', `Bearer ${token}`);
    
    const finalRelevantOrders = finalOrders.body.filter(o => o.stockId === stockId);
    expect(finalRelevantOrders.length).toBe(1);
  });
});
