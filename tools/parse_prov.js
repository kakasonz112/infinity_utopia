const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'src', 'data', 'prov.txt');
const raw = fs.readFileSync(file, 'utf8').split(/\r?\n/);

function num(s){ return parseInt((s||'').replace(/[,\s]/g,'')) || 0 }

const ag = {
  range: {start: null, end: null},
  civilians_killed: 0,
  peasants_added: 0,
  unit_losses: {soldiers:0, quickblades:0, pikemen:0, golems:0, thieves:0, wizards:0, others: {}},
  meteor_events: 0,
  meteor_kills: {peasants:0, soldiers:0, quickblades:0, pikemen:0, golems:0, others:{}},
  gold_gained: 0,
  gold_lost_to_lead: 0,
  books_gained: 0,
  building_credits: 0,
  specialist_credits: 0,
  shipments: {soldiers:0, gold:0},
  land_gained: 0,
  land_lost: 0,
  thief_incidents: 0,
  thief_origins: {},
  troop_deaths_found: 0,
  recruits: [],
  top_incidents: [],
}

function recordTop(date, desc, impact){ ag.top_incidents.push({date,desc,impact}); }

for(const line of raw){
  if(!line.trim()) continue;
  const parts = line.split('\t');
  if(parts.length < 2) continue;
  const date = parts[0].trim();
  const ev = parts[1].trim();

  if(!ag.range.start) ag.range.start = date;
  ag.range.end = date;

  // Meteors
  if(/^Meteors/.test(ev)){
    ag.meteor_events++;
    const m = ev.match(/kill ([^!]+)/);
    if(m){
      const list = m[1].replace(/ and /g, ', ').split(',').map(s=>s.trim()).filter(Boolean);
      let incidentTotal = 0;
      for(const item of list){
        const mm = item.match(/(\d+[\d,]*)\s+([A-Za-z ]+)/);
        if(!mm) continue;
        const n = num(mm[1]);
        let u = mm[2].trim().toLowerCase();
        u = u.replace(/s$/,''); // crude singular
        incidentTotal += n;
        if(u.includes('peasant')) ag.meteor_kills.peasants += n;
        else if(u.includes('soldier')) ag.meteor_kills.soldiers += n;
        else if(u.includes('quickblade')) ag.meteor_kills.quickblades += n;
        else if(u.includes('pikeman')||u.includes('pikemen')||u.includes('pikeme')) ag.meteor_kills.pikemen += n;
        else if(u.includes('golem')) ag.meteor_kills.golems += n;
        else {
          ag.meteor_kills.others[u] = (ag.meteor_kills.others[u]||0) + n;
        }
      }
      recordTop(date, 'Meteor strike', incidentTotal);
      ag.civilians_killed += incidentTotal;
    } else {
      // multi-day forecast line - ignore count
    }
    continue;
  }

  // Monthly income
  let m = ev.match(/generate ([\d,]+) gold coins.*contributing ([\d,]+) books/);
  if(m){ ag.gold_gained += num(m[1]); ag.books_gained += num(m[2]); continue }

  // Gold to lead
  m = ev.match(/([\d,]+) gold coins have been turned into worthless lead/);
  if(m){ ag.gold_lost_to_lead += num(m[1]); recordTop(date,'Gold turned to lead', num(m[1])); continue }

  // Shipments
  m = ev.match(/We have received a shipment of ([\d,]+) soldiers?/);
  if(m){ ag.shipments.soldiers += num(m[1]); continue }
  m = ev.match(/We have received a shipment of ([\d,]+) gold coins?/);
  if(m){ ag.shipments.gold += num(m[1]); ag.gold_gained += num(m[1]); continue }

  // Land settled
  m = ev.match(/settled (\d+) acres of new land/);
  if(m){ ag.land_gained += num(m[1]); continue }
  // Land disappeared
  m = ev.match(/(\d+) acres of land have disappeared from our control/);
  if(m){ ag.land_lost += num(m[1]); continue }

  // Thieves
  m = ev.match(/We have found thieves(?: from (.+?) \(\d+:\d+\))?/);
  if(m){ ag.thief_incidents++; if(m[1]){ const o=m[1].trim(); ag.thief_origins[o]=(ag.thief_origins[o]||0)+1 } continue }

  // Thieves prevented by scout
  m = ev.match(/revealed thieves from (.+?) \(\d+:\d+\)/);
  if(m){ ag.thief_incidents++; const o=m[1].trim(); ag.thief_origins[o]=(ag.thief_origins[o]||0)+1; continue }

  // Troops found dead
  m = ev.match(/(\d+) of our troops were found dead today/);
  if(m){ ag.troop_deaths_found += num(m[1]); continue }

  // Battle/raid lines
  if(ev.startsWith('Forces from')){
    // extract attacker and killed civilians
    const mm = ev.match(/Forces from (.+?) came through and ravaged our lands! Their armies killed ([\d,]+) of our peasants, thieves, and wizards! We lost (.+)/);
    if(mm){
      const attacker = mm[1].trim();
      const civKilled = num(mm[2]);
      ag.civilians_killed += civKilled;
      const lostPart = mm[3];
      // parse losses like "16 soldiers, 597 Pikemen and 80 Golems" or other combos
      const pieces = lostPart.replace(/ and /g, ', ').split(',').map(s=>s.trim()).filter(Boolean);
      let lossTotal = 0;
      for(const p of pieces){
        const p2 = p.replace(/in this battle\.?/,'').trim();
        const m2 = p2.match(/([\d,]+)\s+([A-Za-z ]+)/);
        if(!m2) continue;
        const n = num(m2[1]);
        const unit = m2[2].trim().toLowerCase();
        lossTotal += n;
        if(unit.includes('soldier')) ag.unit_losses.soldiers += n;
        else if(unit.includes('quickblade')) ag.unit_losses.quickblades += n;
        else if(unit.includes('pikeman')||unit.includes('pikemen')) ag.unit_losses.pikemen += n;
        else if(unit.includes('golem')) ag.unit_losses.golems += n;
        else {
          ag.unit_losses.others[unit] = (ag.unit_losses.others[unit]||0)+n;
        }
      }
      recordTop(date, `Raid by ${attacker}`, civKilled + lossTotal);
      continue;
    }
  }

  // Recruits
  m = ev.match(/A new scientist, (.+?) \((.+?)\)/);
  if(m){ ag.recruits.push({name:m[1].trim(), field:m[2].trim(), date}); continue }

  // Grants / end of war resources
  m = ev.match(/received (\d{1,3}(?:,\d{3})*) free building credits to rebuild our lands.*received (\d{1,3}(?:,\d{3})*) free specialist credits.*received (\d{1,3}(?:,\d{3})*) science books/);
  if(m){ ag.building_credits += num(m[1]); ag.specialist_credits += num(m[2]); ag.books_gained += num(m[3]); continue }

  // peasants added
  m = ev.match(/(\d{1,3}(?:,\d{3})*) peasants have populated our lands/);
  if(m){ ag.peasants_added += num(m[1]); continue }

  // runes stolen etc
  m = ev.match(/(\d+[\d,]*) runes of our runes were stolen/);
  if(m){ recordTop(date,'Runes stolen', num(m[1])); continue }

}

// Prepare summary
ag.top_incidents.sort((a,b)=>b.impact - a.impact);
const summary = {
  period: `${ag.range.start} -> ${ag.range.end}`,
  civilians_killed: ag.civilians_killed,
  peasants_added: ag.peasants_added,
  unit_losses: ag.unit_losses,
  meteor_events: ag.meteor_events,
  meteor_kills: ag.meteor_kills,
  gold_gained: ag.gold_gained,
  gold_lost_to_lead: ag.gold_lost_to_lead,
  books_gained: ag.books_gained,
  building_credits: ag.building_credits,
  specialist_credits: ag.specialist_credits,
  shipments: ag.shipments,
  land_gained: ag.land_gained,
  land_lost: ag.land_lost,
  thief_incidents: ag.thief_incidents,
  top_thief_origins: Object.entries(ag.thief_origins).sort((a,b)=>b[1]-a[1]).slice(0,5),
  troop_deaths_found: ag.troop_deaths_found,
  recruits: ag.recruits,
  top_incidents: ag.top_incidents.slice(0,5),
}

// Output JSON and pretty text
const outJson = JSON.stringify(summary, null, 2);
fs.writeFileSync(path.resolve(__dirname,'..','src','data','province_summary.json'), outJson);

console.log('=== Province Summary (aggregated) ===');
console.log(`Period: ${summary.period}`);
console.log(`Civilians killed (aggregate): ${summary.civilians_killed}`);
console.log(`Peasants added: ${summary.peasants_added}`);
console.log('Unit losses:', summary.unit_losses);
console.log(`Meteor events: ${summary.meteor_events}`);
console.log('Meteor kills:', summary.meteor_kills);
console.log(`Gold gained: ${summary.gold_gained}`);
console.log(`Gold lost to lead: ${summary.gold_lost_to_lead}`);
console.log(`Books gained: ${summary.books_gained}`);
console.log(`Shipments: soldiers=${summary.shipments.soldiers}, gold=${summary.shipments.gold}`);
console.log(`Land gained: ${summary.land_gained}, land lost: ${summary.land_lost}`);
console.log(`Thief incidents: ${summary.thief_incidents}`);
console.log(`Top thief origins:`, summary.top_thief_origins);
console.log(`Troop "found dead" total entries: ${summary.troop_deaths_found}`);
console.log(`Recruits: ${summary.recruits.map(r=>r.name+' ('+r.field+')').join(', ')}`);
console.log('\nTop incidents:');
summary.top_incidents.forEach((t,i)=>console.log(`${i+1}. [${t.date}] ${t.desc} (impact ${t.impact})`));

console.log('\nSaved aggregated JSON to src/data/province_summary.json');
