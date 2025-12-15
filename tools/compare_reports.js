const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7 };

function parseDatePrefix(s){
  const m = s.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
  if(!m) return null;
  const mon = m[1].slice(0,3).toLowerCase();
  const day = parseInt(m[2],10);
  const yr = parseInt(m[3],10);
  const monIdx = MONTHS[mon];
  if(!monIdx) return null;
  return {yr, mon: monIdx, day};
}

function dateLE(a,b){
  if(a.yr !== b.yr) return a.yr < b.yr;
  if(a.mon !== b.mon) return a.mon < b.mon;
  return a.day <= b.day;
}

function normalizeProvKey(rawProv) {
  if (!rawProv) return null;
  const s = rawProv.toString().trim();
  const m = s.match(/^\s*(\d+)\s*-\s*(.*)$/);
  if (m) return `${m[1]} - ${m[2].trim()}`;
  if (/an unknown province/i.test(s)) return 'An unknown Province';
  return s;
}

function parseLineToAttack(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]+\s+\d+\s+of\s+YR\d+$/i.test(trimmed)) return null;
  const content = trimmed.replace(/^([A-Za-z]+)\s+\d+\s+of\s+YR\d+\s*\t?/i, '').trim();
  const isInvaded = /invaded/i.test(content);
  const isAttacked = /attacked/i.test(content);
  const isLooted = /looted/i.test(content);
  const isCaptured = /captured/i.test(content);
  const isRazed = /razed/i.test(content);
  const isKilled = /killed/i.test(content);
  const isAttempted = /attempted to invade|attempted an invasion|attempted to invade/i.test(content);
  const isRecaptured = /recaptured/i.test(content);
  const isPillaged = /pillag|pillaged/i.test(content);
  const isConquestStyle = /^.*?,\s*captured\s+\d+/i.test(content);
  const isDragon = /dragon project|Dragon project|begun the .*Dragon|has begun the .*Dragon/i.test(content);
  const isWar = /declared\s+WAR|has declared WAR|we have declared WAR|has declared WAR/i.test(content);
  const isCeasefire = /ceasefire/i.test(content);
  const isAid = /aid shipment|sent an aid shipment|has sent an aid/i.test(content);
  const isDefect = /defected/i.test(content);
  const isCollapse = /collapsed|lies in ruins|has collapsed/i.test(content);
  if (!isInvaded && !isAttacked && !isLooted && !isCaptured && !isRazed && !isKilled && !isAttempted && !isRecaptured && !isPillaged && !isDragon && !isWar && !isCeasefire && !isAid && !isDefect && !isCollapse) return null;
  const dateMatch = trimmed.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
  const date = dateMatch ? dateMatch[0] : '';
  const cleaned = content.replace(/\(\[(\d+:\d+)\]\([^)]*\)\)/g, '($1)');

  let attackerProv, attackerKd, defenderProv, defenderKd;
  let explicitMatched = false;
  const unknownAttackerMatch = cleaned.match(/^An unknown province from\s+(.*?)\s*\((\d+:\d+)\)\s*(?:recaptured|captured|invaded|attacked)[\s\S]*?[\d,]+\s+acres[\s\S]*?\bfrom\s+(.*?)\s*\((\d+:\d+)\)/i);
  if (unknownAttackerMatch) {
    attackerProv = `An unknown province from ${unknownAttackerMatch[1].trim()}`;
    attackerKd = unknownAttackerMatch[2];
    defenderProv = unknownAttackerMatch[3].trim().replace(/-\s*$/, '');
    defenderKd = unknownAttackerMatch[4];
    explicitMatched = true;
  }

  const capFromMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)\s*(?:captured|invaded|attacked)[\s\S]*?([\d,]+)\s+acres[\s\S]*?\bfrom\s+(.*?)\s*\((\d+:\d+)\)/i);
  if (capFromMatch) {
    attackerProv = capFromMatch[1].trim().replace(/-\s*$/, '');
    attackerKd = capFromMatch[2];
    defenderProv = capFromMatch[4].trim().replace(/-\s*$/, '');
    defenderKd = capFromMatch[5];
    explicitMatched = true;
  } else {
    const invadedMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)\s*invaded\s+(.*?)\s*\((\d+:\d+)\)[\s\S]*?captured\s+([\d,]+)\s+acres/i);
    if (invadedMatch) {
      attackerProv = invadedMatch[1].trim().replace(/-\s*$/, '');
      attackerKd = invadedMatch[2];
      defenderProv = invadedMatch[3].trim().replace(/-\s*$/, '');
      defenderKd = invadedMatch[4];
      explicitMatched = true;
    }
    if (!explicitMatched) {
      const razedMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)\s*razed\s+([\d,]+)\s+acres\s+of\s+(.*?)\s*\((\d+:\d+)\)/i);
      if (razedMatch) {
        attackerProv = razedMatch[1].trim().replace(/-\s*$/, '');
        attackerKd = razedMatch[2];
        defenderProv = razedMatch[4].trim().replace(/-\s*$/, '');
        defenderKd = razedMatch[5];
        explicitMatched = true;
      }
    }
    if (!explicitMatched) {
      const killedWithinMatch = cleaned.match(/^(.*?)\s*\((\d+:\d+)\)[\s\S]*?killed\s+(\d[\d,]*)\s+people\s+within\s+(.*?)\s*\((\d+:\d+)\)/i);
      if (killedWithinMatch) {
        attackerProv = killedWithinMatch[1].trim().replace(/-\s*$/, '');
        attackerKd = killedWithinMatch[2];
        defenderProv = killedWithinMatch[4].trim().replace(/-\s*$/, '');
        defenderKd = killedWithinMatch[5];
        explicitMatched = true;
      }
    }
  }
  if (!explicitMatched) {
    const attackerMatch = cleaned.match(/^(.*?)\((\d+:\d+)\)/) || cleaned.match(/^(.*?)\((\d+:\d+)\)/);
    if (attackerMatch) {
      attackerProv = attackerMatch[1].trim().replace(/-\s*$/, '');
      attackerKd = attackerMatch[2];
    }
    const defenderMatch = cleaned.match(/from\s+(.*?)\((\d+:\d+)\)/) || cleaned.match(/invaded\s+(.*?)\((\d+:\d+)\)/);
    if (defenderMatch) {
      defenderProv = defenderMatch[1].trim().replace(/-\s*$/, '');
      defenderKd = defenderMatch[2];
    }
  }

  let type = 'other';
  if (isAttempted) type = 'fail';
  else if (isRazed) type = 'raze';
  else if (isLooted && !isCaptured) type = 'plunder';
  else if (isCaptured && !isRazed) type = 'land';
  else if (isKilled && !isCaptured && !isRazed) type = 'massacre';

  let category = 'Other';
  if (isCollapse) category = 'Killed';
  else if (isDefect) category = /defected to us/i.test(content) ? 'Defected in' : 'Defected out';
  else if (isAid) category = 'Aid';
  else if (isDragon) category = /has begun|begun the/i.test(content) ? 'Starting a Dragon' : 'Dragon Update';
  else if (isWar) category = /we have declared|we have declared WAR/i.test(content) ? 'War Declaration' : 'Enemy Declaration';
  else if (isCeasefire) category = /withdraw|withdrew/i.test(content) ? 'Withdrew Proposal' : 'Ceasefire';
  else if (isRecaptured) category = 'Ambush';
  else if (isPillaged) category = 'Plunder';
  else if (isLooted) category = 'Learn';
  else if (isRazed) category = 'Raze';
  else if (isCaptured && isConquestStyle) category = 'Conquest';
  else if (isCaptured) category = 'Traditional March';
  else if (isKilled) category = 'Massacre';
  else if (isAttempted) category = 'Failed Attack';

  const acresMatch = cleaned.match(/(\d[\d,]*)\s+acres/);
  const acres = acresMatch ? parseInt(acresMatch[1].replace(/,/g, ''), 10) : undefined;
  const booksMatch = cleaned.match(/(\d[\d,]*)\s+books/);
  const books = booksMatch ? parseInt(booksMatch[1].replace(/,/g, ''), 10) : undefined;
  const killsMatch = cleaned.match(/killed\s+(\d[\d,]*)\s+people/);
  const kills = killsMatch ? parseInt(killsMatch[1].replace(/,/g, ''), 10) : undefined;

  const isOutgoing = attackerKd === '3:12';
  return { raw: trimmed, date, attackerProv, attackerKd, defenderProv, defenderKd, type, category, acres, books, kills, isOutgoing };
}

// build attacks using same cutoff as canonical parser
const file = path.join(__dirname, '..', 'src', 'data', 'news.txt');
if (!fs.existsSync(file)) { console.error('news.txt not found at', file); process.exit(1); }
const txt = fs.readFileSync(file, 'utf8');
const rawLines = txt.split(/\r?\n/).map(l=>l);
const cutoff = { yr: 3, mon: 7, day: 23 };
const lines = [];
for(const l of rawLines){
  if(!l || !l.trim()) continue;
  const dateMatch = l.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
  if(!dateMatch) continue;
  const dt = parseDatePrefix(dateMatch[0]);
  if(!dt) continue;
  if(dateLE(dt, cutoff)) lines.push(l.trim());
}

const attacks = [];
let tick = 0;
for(const l of lines){
  const p = parseLineToAttack(l);
  if(p){ tick += 1; p._tick = tick; attacks.push(p); }
}

// generate UI-format report (copy of detailedReportUI logic)
function detailedReportUI(attacks, lines){
  const OUR_KD = '3:12';
  const focalKd = OUR_KD;
  const first = attacks[0];
  const last = attacks[attacks.length - 1];
  const timeWindowFrom = first?.date ?? "";
  const timeWindowTo = last?.date ?? "";

  const made = attacks.filter(a => a.attackerKd === focalKd);
  const suffered = attacks.filter(a => {
    if (a.defenderKd === focalKd) return true;
    const raw = (a.raw || "");
    if (raw.includes(`(${focalKd})`) && a.attackerKd !== focalKd) {
      const attackerPattern = /\(\s*3:12\s*\)\s*(?:captured|invaded|attacked|attempted|set|sent)/i;
      const defenderPattern = /(?:captured|invaded|attacked|razed|recaptured|ambush|killed|looted|pillag)[\s\S]*\(\s*3:12\s*\)/i;
      if (defenderPattern.test(raw)) return true;
      if (!attackerPattern.test(raw) && /invaded|attacked|captured|razed|recaptured|ambush|killed|looted|pillag/i.test(raw)) return true;
    }
    return false;
  });

  const attackCategories = ["Traditional March","Ambush","Conquest","Raze","Massacre","Plunder","Failed Attack"];
  function totalsFor(list){
    const cats = { 'Traditional March': { count: 0, acres: 0 }, 'Ambush': { count: 0, acres: 0 }, 'Conquest': { count: 0, acres: 0 }, 'Raze': { count: 0, acres: 0 }, 'Massacre': { count: 0, kills: 0 }, 'Plunder': { count: 0 }, 'Learn': { count: 0, books: 0 }, 'Failed Attack': { count: 0 } };
    for (const a of list) {
      const c = a.category || 'Other';
      if (!cats[c]) cats[c] = { count: 0, acres: 0 };
      cats[c].count += 1;
      if (a.acres) cats[c].acres = (cats[c].acres || 0) + a.acres;
      if (a.books) cats[c].books = (cats[c].books || 0) + a.books;
      if (a.kills) cats[c].kills = (cats[c].kills || 0) + a.kills;
    }
    const overallAcres = (cats['Traditional March'].acres || 0) + (cats['Ambush'].acres || 0) + (cats['Conquest'].acres || 0);
    const overallCount = Object.values(cats).reduce((s, v) => s + (v.count || 0), 0);
    const overallKills = Object.values(cats).reduce((s, v) => s + (v.kills || 0), 0);
    const uniques = new Set(list.map((a) => (a.attackerKd === focalKd ? a.defenderProv : a.attackerProv)).filter(Boolean)).size;
    return { totals: cats, overallCount, overallAcres, overallKills, uniques };
  }

  const madeStats = totalsFor(made);
  const sufStats = totalsFor(suffered);

  // WINDOW uniques
  const WINDOW = 10;
  let uniqMadeCount = 0;
  const lastTickMade = {};
  for(const a of attacks){
    if (a.attackerKd === focalKd){
      const key = (a.attackerProv || '') + '|' + (a.attackerKd || '');
      const lastT = lastTickMade[key];
      if(!lastT || (a._tick - lastT) >= WINDOW){ uniqMadeCount++; lastTickMade[key] = a._tick; }
    }
  }
  let uniqSufCount = 0;
  const lastTickSuf = {};
  for(const a of attacks){
    if (a.defenderKd === focalKd){
      const key = (a.attackerProv || '') + '|' + (a.attackerKd || '');
      const lastT = lastTickSuf[key];
      if(!lastT || (a._tick - lastT) >= WINDOW){ uniqSufCount++; lastTickSuf[key] = a._tick; }
    }
  }

  function provinceNetFor(kd){
    const map = {};
    const attackCats = new Set(['Traditional March','Ambush','Conquest','Raze','Massacre','Plunder','Failed Attack','Learn']);
    const attackLikeRegex = /invaded|attacked|captured|killed|looted|recaptured|razed|pillag|pillaged|ambush|massacre/i;
    for(const a of attacks){
      if (a.attackerKd === kd && a.attackerProv){
        const raw = normalizeProvKey(a.attackerProv) || a.attackerProv;
        const k = raw;
        if (!map[k]) map[k] = { acres:0, made:0, suffered:0 };
        const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
        if (addAcres) map[k].acres += addAcres;
        if (attackCats.has(a.category || '') || (a.raw && attackLikeRegex.test(a.raw))) map[k].made += 1;
      }
      if (a.defenderKd === kd && a.defenderProv){
        const raw = normalizeProvKey(a.defenderProv) || a.defenderProv;
        const k = raw;
        if (!map[k]) map[k] = { acres:0, made:0, suffered:0 };
        if (a.category === 'Raze') {
        } else if (a.acres) map[k].acres -= a.acres;
        if (attackCats.has(a.category || '') || (a.raw && attackLikeRegex.test(a.raw))) map[k].suffered += 1;
      }
    }
    const entries = Object.entries(map).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
    const filtered = entries.filter((e)=>{
      if (!e.prov || !e.prov.toString().trim()) return false;
      const p = e.prov.toString();
      if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
      if (/^\s*-\s*/.test(p)) return false;
      return true;
    });
    const combined = {};
    for(const e of filtered){
      const raw = (e.prov || '').toString();
      const m = raw.match(/^\s*(\d+)\s*-\s*(.*)$/);
      let id = null; let name;
      if (m) { id = m[1]; name = m[2]; }
      else if (/an unknown province/i.test(raw)) { id = 'xxx'; name = 'An unknown Province'; }
      else { id = ''; name = raw.trim(); }
      const key = `${id}|${name}`;
      if (!combined[key]) combined[key] = { prov: id ? `${id} - ${name}` : `${name}`, acres: 0, made: 0, suffered: 0 };
      combined[key].acres += e.acres || 0;
      combined[key].made += e.made || 0;
      combined[key].suffered += e.suffered || 0;
    }
    const out = Object.entries(combined).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
    out.sort((x,y) => (y.acres||0) - (x.acres||0));
    return out;
  }

  const focalProv = provinceNetFor(focalKd);
  const kdCounts = {};
  for(const a of attacks){ if (a.attackerKd) kdCounts[a.attackerKd] = (kdCounts[a.attackerKd]||0)+1; if (a.defenderKd) kdCounts[a.defenderKd] = (kdCounts[a.defenderKd]||0)+1; }
  const others = Object.keys(kdCounts).filter(k=>k !== focalKd);
  others.sort((a,b)=> kdCounts[b]-kdCounts[a]);
  const topOther = others[0] ?? null;
  const otherProv = topOther ? provinceNetFor(topOther) : [];

  const parseSimpleDateToTick = (s) => {
    const m = s.match(/^([A-Za-z]+)\s+(\d+)\s+of\s+YR(\d+)/i);
    if (!m) return null;
    const DAYS_PER_MONTH_LOCAL = 24;
    const monthName = m[1];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const monthShort = monthName.slice(0,3).toLowerCase();
    const UT_SHORTS = ["jan","feb","mar","apr","may","jun","jul"];
    const monthIndex = UT_SHORTS.indexOf(monthShort);
    if (monthIndex === -1) return null;
    const zeroBased = year * (7*DAYS_PER_MONTH_LOCAL) + monthIndex * DAYS_PER_MONTH_LOCAL + (day - 1);
    return zeroBased + 1;
  };
  const dfTick = parseSimpleDateToTick(timeWindowFrom);
  const dtTick = parseSimpleDateToTick(timeWindowTo);
  let hoursText = 'N/A';
  if (dfTick != null && dtTick != null){ const tickDiff = Math.abs(dtTick - dfTick); hoursText = `${tickDiff} hours`; }

  const header = `** Kingdom news report **\nFor the time from ${timeWindowFrom} till ${timeWindowTo} - ${hoursText}`;
  const bodyLines = [];
  bodyLines.push('');
  bodyLines.push('** Summary **');
  bodyLines.push(`Total attacks made: ${madeStats.overallCount} (${madeStats.overallAcres} acres)`);

  const headerBlock = header + '\n' + bodyLines.join('\n');
  let kingBlock = `\n** The kingdom of ${focalKd} **\n`;
  kingBlock += `Total Acres: ${focalProv.reduce((s,e)=> s + e.acres, 0) >=0 ? '+'+focalProv.reduce((s,e)=> s + e.acres, 0) : focalProv.reduce((s,e)=> s + e.acres, 0)} (${made.length}/${suffered.length})\n`;
  for(const e of focalProv) {
    const provStr = (e.prov || '').toString();
    const m = provStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
    if (m) {
      const id = m[1];
      const name = m[2];
      kingBlock += `${e.acres} | ${id} - ${name} (${e.made}/${e.suffered})\n`;
    } else if (/an unknown province/i.test(provStr)) {
      kingBlock += `${e.acres} | An unknown Province (${e.made}/${e.suffered})\n`;
    } else {
      kingBlock += `${e.acres} | ${provStr} (${e.made}/${e.suffered})\n`;
    }
  }

  return `${headerBlock}\n${kingBlock}`;
}

const canonical = execSync('node tools/parse_news.js', { encoding: 'utf8' });
const ui = detailedReportUI(attacks, lines);

console.log('--- CANONICAL (tools/parse_news.js) ---\n');
console.log(canonical);
console.log('\n--- UI (page.tsx style) ---\n');
console.log(ui);

const canLines = canonical.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
const uiLines = ui.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
const onlyCan = canLines.filter(l=> !uiLines.includes(l));
const onlyUi = uiLines.filter(l=> !canLines.includes(l));
console.log('\n--- LINES IN CANONICAL BUT NOT UI (sample 50) ---');
console.log(onlyCan.slice(0,50).join('\n'));
console.log('\n--- LINES IN UI BUT NOT CANONICAL (sample 50) ---');
console.log(onlyUi.slice(0,50).join('\n'));
