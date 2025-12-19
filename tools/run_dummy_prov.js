const fs = require('fs');
const path = require('path');
const parser = require('../src/lib/provinceParser.js');

const file = path.join(__dirname, '../src/data/prov_dummy.txt');
const raw = fs.readFileSync(file, 'utf8');

const out = parser.parseProvinceNews(raw);

console.log('--- FORMATTED ---');
console.log(out.formatted);
console.log('\n--- JSON ---');
console.log(JSON.stringify(out.json, null, 2));
console.log('\n--- LOG (first 30 lines) ---');
console.log(out.log.slice(0,30).join('\n'));

module.exports = out;
