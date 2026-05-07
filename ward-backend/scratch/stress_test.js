const http = require('http');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3001/api/auth/signup';
const CONCURRENCY = 20;
const TOTAL_REQUESTS = 100;

function postSignup(username) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      username,
      password: 'password123',
      role: 'doctor'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/signup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 201);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function runStressTest() {
  console.log(`Starting stress test: ${TOTAL_REQUESTS} requests with concurrency ${CONCURRENCY}`);
  
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const chunk = [];
    for (let j = 0; j < CONCURRENCY && (i + j) < TOTAL_REQUESTS; j++) {
      const username = `user_${crypto.randomBytes(4).toString('hex')}`;
      chunk.push(postSignup(username));
    }
    
    const results = await Promise.all(chunk);
    results.forEach(res => {
      if (res) successCount++;
      else errorCount++;
    });
    process.stdout.write('.');
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log('\n\nStress Test Results:');
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors (incl. Rate Limited): ${errorCount}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Throughput: ${(TOTAL_REQUESTS / duration).toFixed(2)} req/s`);
  
  if (successCount <= 11) {
    console.log('✅ Rate limiting is working as expected (Max 10 per 15 mins).');
  } else {
    console.log('❌ Rate limiting might be too loose.');
  }
}

runStressTest().catch(console.error);
