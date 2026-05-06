const { parseBarcode } = require('./utils/gs1Parser');

const testCases = [
  { name: 'EAN-13', input: '8901030691234' },
  { name: 'QR URL', input: 'https://ward.example.com/s/123' },
  { name: 'GS1-128 with parens', input: '(01)08901234567890(17)261231(10)LOT123' },
  { name: 'GS1-128 flat', input: '01089012345678901726123110LOT456' },
  { name: 'Unknown/Random', input: 'ABC-XYZ-789' }
];

testCases.forEach(tc => {
  console.log(`--- Test: ${tc.name} ---`);
  console.log(`Input: ${tc.input}`);
  console.log(JSON.stringify(parseBarcode(tc.input), null, 2));
});
