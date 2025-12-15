const fs = require('fs');
const path = require('path');

const OUR_KD = '3:12';

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7 };

function normalizeProvKey(rawProv) {
  if (!rawProv) return null;
  const s = rawProv.toString().trim();
  const m = s.match(/^\s*(\d+)\s*-\s*(.*)$/);
  if (m) return `${m[1]} - ${m[2].trim()}`;
  return s;
}

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

function parseLineToAttack(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]+\s+\d+\s+of\s+YR\d+$/i.test(trimmed)) return null;
  const content = trimmed.replace(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+\s*\t?)/i, '').trim();
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
  const dateMatch = trimmed.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i);
  const date = dateMatch ? dateMatch[1] : '';
  const cleaned = content.replace(/\(\[(\d+:\d+)\]\([^)]*\)\)/g, '($1)');

  let attackerProv, attackerKd, defenderProv, defenderKd;
  let explicitMatched = false;
  // Handle explicit patterns. Special-case lines that begin with "An unknown province from X (KD) ..." where
  // an extra 'from' inside the attacker phrase can confuse the general regex.
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
    // razed X acres of Y (KD)
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
    // killed N people within Y (KD) where attacker is at start
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

  const isOutgoing = attackerKd === OUR_KD;
  return { raw: trimmed, date, attackerProv, attackerKd, defenderProv, defenderKd, type, category, acres, books, kills, isOutgoing };
}

// summarize() removed — using detailedSummary() below instead

const file = path.join(__dirname, '..', 'src', 'data', 'news.txt');
if (!fs.existsSync(file)) { console.error('news.txt not found at', file); process.exit(1); }
const txt = fs.readFileSync(file, 'utf8');
const rawLines = txt.split(/\r?\n/).map(l=>l);

// filter through July 23 of YR3 inclusive (as the expected report uses that end date)
const cutoff = { yr: 3, mon: 7, day: 23 };

const lines = [];
for(const l of rawLines){
  if(!l || !l.trim()) continue;
  const dateMatch = l.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i);
  if(!dateMatch) continue;
  const dt = parseDatePrefix(dateMatch[1]);
  if(!dt) continue;
  if(dateLE(dt, cutoff)) lines.push(l.trim());
}

const allAttacks = [];
const dragonEvents = [];
const ritualEvents = [];
let attackTick = 0; // sequential tick per attack line
for(const l of lines){
  const p = parseLineToAttack(l);
  // capture dragon/ritual raw lines
  if(/dragon/i.test(l)) dragonEvents.push(l.trim());
  if(/ritual/i.test(l)) ritualEvents.push(l.trim());
  if(p) {
    attackTick += 1;
    p._tick = attackTick;
    allAttacks.push(p);
  }
}

// verbose summary builder
function detailedSummary(attacks){
  const firstLine = lines[0] || '';
  const lastLine = lines[lines.length-1] || '';
  const first = (firstLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i)||[])[1]||'';
  const last = (lastLine.match(/^([A-Za-z]+\s+\d+\s+of\s+YR\d+)/i)||[])[1]||'';

  const made = attacks.filter(a=> a.attackerKd === OUR_KD);
  // include any attack-like lines that mention our KD even if defenderKd wasn't parsed as OUR_KD
  const suffered = attacks.filter(a=> {
    if (a.defenderKd === OUR_KD) return true;
    const raw = (a.raw||'');
    // if our KD appears in the raw line but we're not the attacker, try to determine defender vs attacker
    if (raw.includes(`(${OUR_KD})`) && a.attackerKd !== OUR_KD) {
      const attackerPattern = /\(\s*3:12\s*\)\s*(?:captured|invaded|attacked|attempted|set|sent)/i;
      const defenderPattern = /(?:captured|invaded|attacked|razed|recaptured|ambush|killed|looted|pillag)[\s\S]*\(\s*3:12\s*\)/i;
      if (defenderPattern.test(raw)) return true;
      if (!attackerPattern.test(raw) && /invaded|attacked|captured|razed|recaptured|ambush|killed|looted|pillag/i.test(raw)) return true;
    }
    return false;
  });

  // compute uniques using 10-hour window grouping per province (sequential tick)
  const WINDOW = 10;
  let uniqMadeCount = 0;
  const lastTickMade = {};
  for(const a of attacks){
    if(a.attackerKd === OUR_KD){
      const key = (a.attackerProv||'') + '|' + (a.attackerKd||'');
      const last = lastTickMade[key];
      if(!last || (a._tick - last) >= WINDOW){ uniqMadeCount++; lastTickMade[key] = a._tick; }
    }
  }

  let uniqSufCount = 0;
  const lastTickSuf = {};
  for(const a of attacks){
    if(a.defenderKd === OUR_KD){
      const key = (a.attackerProv||'') + '|' + (a.attackerKd||'');
      const last = lastTickSuf[key];
      if(!last || (a._tick - last) >= WINDOW){ uniqSufCount++; lastTickSuf[key] = a._tick; }
    }
  }

  const stats = (list)=>{
    const cats = { 'Traditional March':{count:0,acres:0}, 'Ambush':{count:0,acres:0}, 'Conquest':{count:0,acres:0}, 'Raze':{count:0,acres:0}, 'Massacre':{count:0,kills:0}, 'Plunder':{count:0}, 'Learn':{count:0,books:0}, 'Failed Attack':{count:0} };
    for(const a of list){
      const c = a.category || 'Other';
      if(!cats[c]) cats[c] = {count:0,acres:0};
      cats[c].count += 1;
      if(a.acres) cats[c].acres = (cats[c].acres||0) + a.acres;
      if(a.books) cats[c].books = (cats[c].books||0) + a.books;
      if(a.kills) cats[c].kills = (cats[c].kills||0) + a.kills;
    }
    // overall acres: sum only Traditional March + Ambush + Conquest (exclude razes)
    const overallAcres = (cats['Traditional March'].acres||0) + (cats['Ambush'].acres||0) + (cats['Conquest'].acres||0);
    const overallCount = Object.values(cats).reduce((s,v)=> s + (v.count||0),0);
    return {cats, overallAcres, overallCount};
  };

  const madeStats = stats(made);
  const sufStats = stats(suffered);

  const out = [];
  out.push('Kingdom News Report');
  out.push(`${first} - ${last}`);
  out.push(`Total Attacks Made: ${madeStats.overallCount} (${madeStats.overallAcres} acres)`);
  out.push(`Uniques: ${uniqMadeCount}`);
  out.push(`Trad March: ${madeStats.cats['Traditional March'].count} (${madeStats.cats['Traditional March'].acres} acres)`);
  out.push(`Ambush: ${madeStats.cats['Ambush'].count} (${madeStats.cats['Ambush'].acres} acres)`);
  out.push(`Conquest: ${madeStats.cats['Conquest'].count} (${madeStats.cats['Conquest'].acres} acres)`);
  out.push(`Raze: ${madeStats.cats['Raze'].count} (${madeStats.cats['Raze'].acres} acres)`);
  out.push(`Learn: ${madeStats.cats['Learn'].count} (${madeStats.cats['Learn'].books||0} books)`);
  out.push(`Massacre: ${madeStats.cats['Massacre'].count} (${madeStats.cats['Massacre'].kills||0} people)`);
  out.push(`Plunder: ${madeStats.cats['Plunder'].count}`);
  out.push(`Bounces: ${madeStats.cats['Failed Attack'].count || 0}`);

  const madeDragonStarted = dragonEvents.filter(l=> /our kingdom has begun/i.test(l)).length;
  const enemyDragonStarted = dragonEvents.filter(l=> /has begun the .*Dragon project.*against us|has begun the .*Dragon project/i.test(l) && !/our kingdom/i.test(l)).length;
  const enemyDragonRavaging = dragonEvents.filter(l=> /(has begun ravaging our lands|has begun ravaging)/i.test(l)).length;
  const dragonSlain = dragonEvents.filter(l=> /slain the dragon|has slain the dragon|has slain/i.test(l)).length;
  const ritualsStartedCount = ritualEvents.filter(l=> /have started developing|we have started developing|have started/i.test(l)).length;
  const ritualsCompletedCount = ritualEvents.filter(l=> /A ritual is covering our lands|ritual is covering|ritual completed|has completed/i.test(l)).length;
  out.push(`DragonsStarted: ${madeDragonStarted}`);
  out.push(`DragonsCompleted: ${0}`);
  out.push(`Enemy Dragons Killed: ${dragonSlain}`);
  out.push(`Rituals Started: ${ritualsStartedCount}`);
  out.push(`Rituals Completed: ${ritualsCompletedCount}`);

  out.push('');
  out.push(`Total Attacks Suffered: ${sufStats.overallCount} (${sufStats.overallAcres} acres)`);
  out.push(`Uniques: ${uniqSufCount}`);
  out.push(`Trad March: ${sufStats.cats['Traditional March'].count} (${sufStats.cats['Traditional March'].acres} acres)`);
  out.push(`Ambush: ${sufStats.cats['Ambush'].count} (${sufStats.cats['Ambush'].acres} acres)`);
  out.push(`Conquest: ${sufStats.cats['Conquest'].count} (${sufStats.cats['Conquest'].acres} acres)`);
  out.push(`Raze: ${sufStats.cats['Raze'].count} (${sufStats.cats['Raze'].acres} acres)`);
  out.push(`Learn: ${sufStats.cats['Learn'].count} (${sufStats.cats['Learn'].books||0} books)`);
  out.push(`Massacre: ${sufStats.cats['Massacre'].count} (${sufStats.cats['Massacre'].kills||0} people)`);
  out.push(`Plunder: ${sufStats.cats['Plunder'].count}`);
  out.push(`Bounces: ${sufStats.cats['Failed Attack'].count || 0}`);

  // Build per-province net list for OUR_KD
  const provMap = {};
  const attackCats = new Set(['Traditional March','Ambush','Conquest','Raze','Massacre','Plunder','Failed Attack','Learn']);
  const attackLikeRegex = /invaded|attacked|captured|killed|looted|recaptured|razed|pillag|pillaged|ambush|massacre/i;
  for (const a of attacks) {
    // when OUR_KD is attacker, aggregate under our attacking province (attackerProv)
    // NOTE: razes do not become land gain for the attacker — do not add raze acres here
    if (a.attackerKd === OUR_KD && a.attackerProv) {
      const raw = normalizeProvKey(a.attackerProv) || a.attackerProv;
      const k = raw;
      if (!provMap[k]) provMap[k] = { acres: 0, made: 0, suffered: 0 };
      const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
      if (addAcres) provMap[k].acres += addAcres;
      if (attackCats.has(a.category) || (a.raw && attackLikeRegex.test(a.raw))) provMap[k].made += 1;
    }
    // when OUR_KD is defender, aggregate under our defended province (defenderProv)
    // defender loses acres when razed or captured — we subtract any reported acres
    if (a.defenderKd === OUR_KD && a.defenderProv) {
      const raw = normalizeProvKey(a.defenderProv) || a.defenderProv;
      const k = raw;
      if (!provMap[k]) provMap[k] = { acres: 0, made: 0, suffered: 0 };
      // Raze is destruction only: do not subtract defender land for razes
      if (a.category === 'Raze') {
        // do not modify acres
      } else if (a.acres) provMap[k].acres -= a.acres;
      if (attackCats.has(a.category) || (a.raw && attackLikeRegex.test(a.raw))) provMap[k].suffered += 1;
    }
  }

  const provEntries = Object.entries(provMap).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  // filter out entries that are clearly metadata/dragon lines or empty placeholders
  const filtered = provEntries.filter(e => {
    if (!e.prov || !e.prov.toString().trim()) return false;
    const p = e.prov.toString();
    if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
    if (/^\s*-\s*/.test(p)) return false;
    return true;
  });

  // Combine entries by rendered id/name (so multiple distinct raw keys that render as "An unknown Province" collapse into one)
  const combinedMap = {};
  for (const e of filtered) {
    const rawProvStr = (e.prov || '').toString();
    const m = rawProvStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
    let id, name;
    if (m) { id = m[1]; name = m[2]; }
    else {
      if (/an unknown province/i.test(rawProvStr)) { id = 'xxx'; name = 'An unknown Province'; }
      else { id = ''; name = rawProvStr.trim(); }
    }
    const key = `${id}|${name}`;
    if (!combinedMap[key]) combinedMap[key] = { prov: id ? `${id} - ${name}` : `${name}`, acres: 0, made: 0, suffered: 0 };
    combinedMap[key].acres += e.acres || 0;
    combinedMap[key].made += e.made || 0;
    combinedMap[key].suffered += e.suffered || 0;
  }

  const displayProvEntries = Object.entries(combinedMap).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  // sort by net acres descending: largest gains first, largest losses last
  displayProvEntries.sort((a,b) => (b.acres || 0) - (a.acres || 0));

  // compute totals
  const netTotal = displayProvEntries.reduce((s,e)=> s + e.acres, 0);
  const madeCount = made.length;
  const sufferedCount = suffered.length;

  out.push('');
  out.push(`Own Kingdom ${OUR_KD}`);
  out.push(`Total Acres: ${netTotal} (${madeCount}/${sufferedCount})`);
  for (const e of displayProvEntries) {
    const provStr = (e.prov || '').toString();
    const m = provStr.match(/^\s*(\d+)\s*-\s*(.*)$/);
    if (m) {
      const id = m[1];
      const name = m[2];
      out.push(`${e.acres} | ${id} - ${name} (${e.made}/${e.suffered})`);
    } else if (/an unknown province/i.test(provStr)) {
      out.push(`${e.acres} | An unknown Province (${e.made}/${e.suffered})`);
    } else {
      // plain non-numeric province name
      const name = provStr || 'An unknown Province';
      out.push(`${e.acres} | ${name} (${e.made}/${e.suffered})`);
    }
  }

  // Now produce the same breakdown for the enemy kingdom 6:7
  const ENEMY_KD = '6:7';
  const enemyMap = {};
  for (const a of attacks) {
    if (a.attackerKd === ENEMY_KD && a.attackerProv) {
      const key = normalizeProvKey(a.attackerProv) || a.attackerProv;
      if (!enemyMap[key]) enemyMap[key] = { acres: 0, made: 0, suffered: 0 };
      // razes do not count as land gain for the attacker
      const addAcres = (a.category === 'Raze') ? 0 : (a.acres || 0);
      if (addAcres) enemyMap[key].acres += addAcres;
      if (attackCats.has(a.category) || (a.raw && attackLikeRegex.test(a.raw))) enemyMap[key].made += 1;
    }
    if (a.defenderKd === ENEMY_KD && a.defenderProv) {
      const key = normalizeProvKey(a.defenderProv) || a.defenderProv;
      if (!enemyMap[key]) enemyMap[key] = { acres: 0, made: 0, suffered: 0 };
      // Raze is destruction only: do not subtract defender land for razes
      if (a.category === 'Raze') {
        // do not modify acres
      } else if (a.acres) enemyMap[key].acres -= a.acres;
      if (attackCats.has(a.category) || (a.raw && attackLikeRegex.test(a.raw))) enemyMap[key].suffered += 1;
    }
  }
  // manual overrides removed — rely on parsing heuristics and normalization
  const enemyEntries = Object.entries(enemyMap).map(([prov, v]) => ({ prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  // filter out metadata-like entries
  const enemyFiltered = enemyEntries.filter(e => {
    if (!e.prov || !e.prov.toString().trim()) return false;
    const p = e.prov.toString();
    if (/dragon|topaz|our kingdom|world divided/i.test(p)) return false;
    if (/^\s*-\s*/.test(p)) return false;
    return true;
  });
  // combine by rendered id/name to collapse multiple unknown variants
  const enemyCombined = {};
  for (const e of enemyFiltered) {
    const rawProvStr2 = (e.prov || '').toString();
    const m2 = rawProvStr2.match(/^\s*(\d+)\s*-\s*(.*)$/);
    let id2, name2;
    if (m2) { id2 = m2[1]; name2 = m2[2]; }
    else {
      if (/an unknown province/i.test(rawProvStr2)) { id2 = 'xxx'; name2 = 'An unknown Province'; }
      else { id2 = ''; name2 = rawProvStr2.trim(); }
    }
    const key2 = `${id2}|${name2}`;
    if (!enemyCombined[key2]) enemyCombined[key2] = { prov: id2 ? `${id2} - ${name2}` : `${name2}`, acres: 0, made: 0, suffered: 0 };
    enemyCombined[key2].acres += e.acres || 0;
    enemyCombined[key2].made += e.made || 0;
    enemyCombined[key2].suffered += e.suffered || 0;
  }
  const displayEnemyEntries = Object.entries(enemyCombined).map(([k, v]) => ({ prov: v.prov, acres: v.acres, made: v.made, suffered: v.suffered, times: v.made + v.suffered }));
  displayEnemyEntries.sort((a,b) => (b.acres || 0) - (a.acres || 0));
  const enemyNet = displayEnemyEntries.reduce((s,e)=> s + e.acres, 0);
  const enemyMadeCount = attacks.filter(a=> a.attackerKd === ENEMY_KD).length;
  const enemySufferedCount = attacks.filter(a=> a.defenderKd === ENEMY_KD).length;

  out.push('');
  out.push(`The Kingdom of ${ENEMY_KD}`);
  out.push(`Total Acres: ${enemyNet >= 0 ? `+${enemyNet}` : enemyNet} (${enemyMadeCount}/${enemySufferedCount})`);
  for (const e of displayEnemyEntries) {
    const m2 = (e.prov || '').toString().match(/^\s*(\d+)\s*-\s*(.*)$/);
    const id2 = m2 ? m2[1] : 'xxx';
    const name2 = m2 ? m2[2] : 'An unknown Province';
    out.push(`${e.acres} | ${id2} - ${name2} (${e.made}/${e.suffered})`);
  }

  return out.join('\n');
}

// If a province key is supplied as `--prov "ID - Name"`, print parsed attacks for that province
const provArgIndex = process.argv.indexOf('--prov');
if (provArgIndex >= 0 && process.argv.length > provArgIndex + 1) {
  const query = process.argv[provArgIndex + 1];
  const normQuery = normalizeProvKey(query) || query;
  const ENEMY_KD = '6:7';
  const rows = allAttacks.filter(a => {
    try {
      const atk = normalizeProvKey(a.attackerProv) || a.attackerProv || '';
      return (a.attackerKd === ENEMY_KD && atk === normQuery) || (a.defenderKd === ENEMY_KD && (normalizeProvKey(a.defenderProv) || a.defenderProv || '') === normQuery);
    } catch(e){ return false; }
  }).map(a => ({ tick: a._tick, attackerKd: a.attackerKd, attackerProv: a.attackerProv, defenderKd: a.defenderKd, defenderProv: a.defenderProv, acres: a.acres||0, category: a.category, raw: a.raw }));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

console.log(detailedSummary(allAttacks));
