const adapter = require('../db-adapter');

async function test() {
  console.log(`Testing with dialect: ${adapter.dialect}`);
  try {
    if (adapter.dialect === 'postgres') {
      const now = await adapter.queryOne('SELECT NOW() AS now', []);
      console.log('Postgres NOW:', now.now);
    } else {
      const now = await adapter.queryOne("SELECT datetime('now') AS now", []);
      console.log('SQLite NOW:', now.now);
    }
    
    // Test transaction
    const result = await adapter.withTransaction(async (tx) => {
      const val = await tx.queryOne('SELECT 1 + 1 AS val', []);
      return val.val;
    });
    console.log('Transaction test (1+1):', result);
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
