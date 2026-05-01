const http = require('http');

const CONCURRENCY = 50;
const TOTAL_REQUESTS = 500;
const URL = 'http://localhost:3001/health';

let completed = 0;
let failed = 0;
let startTime = Date.now();

function makeRequest() {
  if (completed + failed >= TOTAL_REQUESTS) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nStress Test Complete:`);
    console.log(`- Total Requests: ${TOTAL_REQUESTS}`);
    console.log(`- Successful: ${completed}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total Duration: ${duration.toFixed(2)}s`);
    console.log(`- Avg RPS: ${(TOTAL_REQUESTS / duration).toFixed(2)}`);
    return;
  }

  const req = http.get(URL, (res) => {
    if (res.statusCode === 200) {
      completed++;
    } else {
      failed++;
    }
    res.resume();
    makeRequest();
  });

  req.on('error', (err) => {
    failed++;
    makeRequest();
  });
}

console.log(`Starting stress test on ${URL} with concurrency ${CONCURRENCY}...`);
for (let i = 0; i < CONCURRENCY; i++) {
  makeRequest();
}
