const fs = require('fs');
const path = require('path');

const samplePath = path.resolve(__dirname, '..', 'src', 'data', 'province_report_sample.txt');
const expectPath = path.resolve(__dirname, '..', 'tests', 'province_summary_expectations.json');

const sample = fs.readFileSync(samplePath, 'utf8');
const expectations = JSON.parse(fs.readFileSync(expectPath, 'utf8')).expectations;

let missing = [];
for (const exp of expectations) {
  if (!sample.includes(exp)) missing.push(exp);
}

if (missing.length === 0) {
  console.log('All expectations found: PASS');
  process.exit(0);
} else {
  console.error('Missing expectations:');
  missing.forEach(m => console.error('- ' + m));
  process.exit(1);
}
