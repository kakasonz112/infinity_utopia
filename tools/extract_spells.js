const fs = require('fs');
const path = require('path');

function extractTOCText(html) {
  const matches = [...html.matchAll(/<li class="toclevel-2[\s\S]*?<span class="toctext">([^<]+?)<\/span>/gi)];
  return matches.map(m => m[1].trim());
}

function run() {
  const base = path.join(__dirname, '..', 'src', 'data');
  const mysticsPath = path.join(base, 'Mystics - The Utopian Encyclopedia.html');
  const thieveryPath = path.join(base, 'Thievery - The Utopian Encyclopedia.html');
  const mystics = fs.readFileSync(mysticsPath, 'utf8');
  const thievery = fs.readFileSync(thieveryPath, 'utf8');

  const spells = extractTOCText(mystics).filter(Boolean);
  const ops = extractTOCText(thievery).filter(Boolean);

  console.log('SPELLS:');
  console.log(JSON.stringify(spells, null, 2));
  console.log('\nTHIEVERY OPS:');
  console.log(JSON.stringify(ops, null, 2));
}

run();
