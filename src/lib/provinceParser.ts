// Lightweight province news parser for client-side use
export function parseProvinceNews(rawText: string) {
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Comprehensive known spell names and common aliases (from Mystics page)
  const SPELLS: Array<{name:string, pattern:string}> = [
    { name: 'Aggression', pattern: 'Aggression' },
    { name: 'Animate Dead', pattern: 'Animate Dead' },
    { name: 'Anonymity', pattern: 'Anonymity' },
    { name: 'Bloodlust', pattern: 'Bloodlust' },
    { name: "Builders' Boon", pattern: "Builders'? Boon" },
    { name: 'Clear Sight', pattern: 'Clear Sight' },
    { name: 'Divine Shield', pattern: 'Divine Shield' },
    { name: 'Fanaticism', pattern: 'Fanaticism' },
    { name: 'Fertile Lands', pattern: 'Fertile Lands' },
    { name: 'Fountain of Knowledge', pattern: 'Fountain of Knowledge' },
    { name: 'Greater Protection', pattern: 'Greater Protection' },
    { name: 'Guile', pattern: 'Guile' },
    { name: 'Illuminate Shadows', pattern: 'Illuminate Shadows' },
    { name: 'Inspire Army', pattern: 'Inspire Army' },
    { name: 'Invisibility', pattern: 'Invisibility' },
    { name: "Love & Peace", pattern: 'Love\s*&\s*Peace|Love\s+and\s+Peace' },
    { name: "Mage's Fury", pattern: "Mage'?s Fury" },
    { name: 'Magic Shield', pattern: 'Magic Shield' },
    { name: 'Mind Focus', pattern: 'Mind Focus' },
    { name: "Miner's Mystique", pattern: "Miner'?s Mystique" },
    { name: 'Minor Protection', pattern: 'Minor Protection' },
    { name: 'Mist', pattern: '\\bMist\\b' },
    { name: "Nature's Blessing", pattern: "Nature'?s Blessing" },
    { name: 'Paradise', pattern: 'Paradise' },
    { name: 'Patriotism', pattern: 'Patriotism' },
    { name: 'Quick Feet', pattern: 'Quick Feet' },
    { name: 'Reflect Magic', pattern: 'Reflect Magic' },
    { name: 'Revelation', pattern: 'Revelation' },
    { name: 'Righteous Aggressor', pattern: 'Righteous Aggressor' },
    { name: 'Salvation', pattern: 'Salvation' },
    { name: 'Shadowlight', pattern: 'Shadowlight' },
    { name: 'Town Watch', pattern: 'Town Watch' },
    { name: 'Tree of Gold', pattern: 'Tree of Gold' },
    { name: 'War Spoils', pattern: 'War Spoils' },
    { name: 'Wrath', pattern: 'Wrath' },
    { name: 'Abolish Ritual', pattern: 'Abolish Ritual' },
    { name: 'Amnesia', pattern: 'Amnesia' },
    { name: 'Blizzard', pattern: 'Blizzard|Blizzards' },
    { name: 'Chastity', pattern: 'Chastity' },
    { name: 'Crystal Ball', pattern: 'Crystal Ball' },
    { name: 'Crystal Eye', pattern: 'Crystal Eye' },
    { name: 'Droughts', pattern: 'Droughts|Drought' },
    { name: 'Explosions', pattern: 'Explosions' },
    { name: 'Expose Thieves', pattern: 'Expose Thieves' },
    { name: 'Fireball', pattern: 'Fireball' },
    { name: "Fool's Gold", pattern: "Fool'?s Gold|turned into worthless lead" },
    { name: 'Gluttony', pattern: 'Gluttony' },
    { name: 'Greed', pattern: 'Greed' },
    { name: 'Lightning Strike', pattern: 'Lightning Strike' },
    { name: 'Land Lust', pattern: 'Land Lust' },
    { name: 'Magic Ward', pattern: 'Magic Ward' },
    { name: 'Meteor Showers', pattern: 'Meteor Showers|Meteors|Meteors rain' },
    { name: 'Mystic Vortex', pattern: 'Mystic Vortex|Magic Vortex' },
    { name: 'Nightmares', pattern: 'Nightmares' },
    { name: 'Nightfall', pattern: 'Nightfall' },
    { name: 'Pitfalls', pattern: 'Pitfalls' },
    { name: 'Storms', pattern: 'Storms' },
    { name: 'Tornadoes', pattern: 'Tornadoes' },
    { name: 'Vermin', pattern: 'Vermin' },
    { name: 'Barrier of Integrity', pattern: 'Barrier of Integrity' },
    { name: 'Fog', pattern: 'Fog' },
    { name: 'Ghost Workers', pattern: 'Ghost Workers' },
    { name: 'Haste', pattern: 'Haste' },
    { name: "Hero's Inspiration", pattern: "Hero'?s Inspiration" },
    { name: 'Illusionary', pattern: 'Illusionary' },
    { name: 'Mystic Aura', pattern: 'Mystic Aura' },
    { name: 'Scientific Insights', pattern: 'Scientific Insights' },
    { name: 'Sloth', pattern: 'Sloth' },
    { name: 'Soul Blight', pattern: 'Soul Blight' }
  ];

  // Known thievery operations for detection (from Thievery page)
  const THIEVERY_OPS: Array<{name:string, pattern:string}> = [
    { name: 'Spy on Throne', pattern: 'Spy on Throne|Spy on the Throne' },
    { name: 'Spy on Defense', pattern: 'Spy on Defense' },
    { name: 'Spy on Exploration', pattern: 'Spy on Exploration' },
    { name: 'Snatch News', pattern: 'Snatch News' },
    { name: 'Infiltrate', pattern: 'Infiltrate' },
    { name: 'Survey', pattern: 'Survey' },
    { name: 'Spy on Military', pattern: 'Spy on Military' },
    { name: 'Spy on Sciences', pattern: 'Spy on Sciences' },
    { name: 'Sabotage Wizards', pattern: 'Sabotage Wizards' },
    { name: 'Destabilize Guilds', pattern: 'Destabilize Guilds' },
    { name: 'Rob the Granaries', pattern: 'Rob the Granaries' },
    { name: 'Rob the Vaults', pattern: 'Rob the Vaults' },
    { name: 'Rob the Towers', pattern: 'Rob the Towers|steal from our towers|steal from towers' },
    { name: 'Kidnapping', pattern: 'Kidnapping' },
    { name: 'Arson', pattern: 'Arson' },
    { name: 'Greater Arson', pattern: 'Greater Arson' },
    { name: 'Night Strike', pattern: 'Night Strike|Nightstrike' },
    { name: 'Incite Riots', pattern: 'Incite Riots' },
    { name: 'Steal War Horses', pattern: 'Steal War Horses' },
    { name: 'Bribe Thieves', pattern: 'Bribe Thieves' },
    { name: 'Bribe Generals', pattern: 'Bribe Generals' },
    { name: 'Free Prisoners', pattern: 'Free Prisoners' },
    { name: 'Assassinate Wizards', pattern: 'Assassinate Wizards' },
    { name: 'Propaganda', pattern: 'Propaganda' },
    { name: 'Expose Thieves', pattern: 'Expose Thieves' }
  ];

  const num = (s: string|number|undefined) => {
    if (!s && s !== 0) return 0;
    return parseInt(String(s).replace(/[ ,]/g, ''), 10) || 0;
  };

  const ag: any = {
    range: { start: null, end: null },
    civilians_killed: 0,
    peasants_added: 0,
    unit_losses: { soldiers: 0, quickblades: 0, pikemen: 0, golems: 0, others: {} },
    meteor_events: 0,
    meteor_kills: { peasants: 0, soldiers: 0, quickblades: 0, pikemen: 0, golems: 0, others: {} },
    gold_gained: 0,
    gold_lost_to_lead: 0,
    books_gained: 0,
    building_credits: 0,
    specialist_credits: 0,
    shipments: { soldiers: 0, gold: 0 },
    land_gained: 0,
    land_lost: 0,
    thief_incidents: 0,
    thief_origins: {},
    troop_deaths_found: 0,
    recruits: [],
    top_incidents: [],
    raids: [],
    meteorForecasts: 0,
    magery_failures: {},
    mageryEffects: {} as Record<string, number>,
    thievery_ops: {} as Record<string, number>,
  };
  const log: string[] = [];

  function recordTop(date: string, desc: string, impact: number) {
    ag.top_incidents.push({ date, desc, impact });
  }

  for (const line of rawLines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const date = parts[0].trim();
    const ev = parts[1].trim();
    if (!ag.range.start) ag.range.start = date;
    ag.range.end = date;

    // Meteors
    if (/^Meteors/i.test(ev)) {
      ag.meteor_events++;
      // forecast / prolonged meteors
      if (/are not expected to stop/i.test(ev)) {
        ag.meteorForecasts++;
        log.push('Meteors spell effect');
        ag.mageryEffects['Meteors'] = (ag.mageryEffects['Meteors']||0)+1;
        continue;
      }

      const m = ev.match(/kill ([^!]+)/i);
      if (m) {
        const list = m[1].replace(/ and /gi, ', ').split(',').map(s=>s.trim()).filter(Boolean);
        let incidentTotal = 0;
        for (const item of list) {
          const mm = item.match(/(\d[\d,]*)\s+([A-Za-z]+)/);
          if (!mm) continue;
          const n = num(mm[1]);
          const u = mm[2].toLowerCase();
          incidentTotal += n;
          if (u.includes('peasant')) ag.meteor_kills.peasants += n;
          else if (u.includes('soldier')) ag.meteor_kills.soldiers += n;
          else if (u.includes('quickblade')) ag.meteor_kills.quickblades += n;
          else if (u.includes('pikeman') || u.includes('pikemen')) ag.meteor_kills.pikemen += n;
          else if (u.includes('golem')) ag.meteor_kills.golems += n;
          else ag.meteor_kills.others[u] = (ag.meteor_kills.others[u]||0)+n;
        }
        recordTop(date, 'Meteor strike', incidentTotal);
        ag.civilians_killed += incidentTotal;
        // logging
        const details = list.join(', ');
        log.push(`Meteors damage: ${incidentTotal} troops killed (${details})`);
      }
      continue;
    }

    // Meteors forecast/effect line
    if (/Meteors rain across our lands, and are not expected to stop/i.test(ev)) {
      ag.meteorForecasts++;
      log.push('Meteors spell effect');
      continue;
    }

    // Monthly income
    let m = ev.match(/generate\s+([\d,]+)\s+gold\s+coins.*contributing\s+([\d,]+)\s+books/i);
    if (m) { ag.gold_gained += num(m[1]); ag.books_gained += num(m[2]); continue }

    // Gold to lead
    m = ev.match(/([\d,]+)\s+gold\s+coins\s+have\s+been\s+turned\s+into\s+worthless\s+lead/i);
    if (m) { ag.gold_lost_to_lead += num(m[1]); recordTop(date,'Gold turned to lead', num(m[1])); log.push(`Unknown event: ${date} ${ev.length>60?ev.slice(0,60)+'...':ev}`); continue }

    // Shipments
    m = ev.match(/We have received a shipment of\s+([\d,]+)\s+soldiers?/i);
    if (m) { ag.shipments.soldiers += num(m[1]); log.push(`Received aid: ${num(m[1])} soldiers from ${ev.replace(/^.*from\s+/i,'')}`); continue }
    m = ev.match(/We have received a shipment of\s+([\d,]+)\s+gold coins?/i);
    if (m) { ag.shipments.gold += num(m[1]); ag.gold_gained += num(m[1]); log.push(`Received aid: ${num(m[1])} gold coins from ${ev.replace(/^.*from\s+/i,'')}`); continue }

    // Land settled
    m = ev.match(/settled\s+(\d+)\s+acres\s+of\s+new\s+land/i);
    if (m) { ag.land_gained += num(m[1]); log.push(`Daily bonus: ${num(m[1])} acres settled`); continue }
    // Land disappeared
    m = ev.match(/(\d+)\s+acres\s+of\s+land\s+have\s+disappeared\s+from\s+our\s+control/i);
    if (m) { ag.land_lost += num(m[1]); log.push(`Land lust: ${num(m[1])} acres lost`); continue }

    // Thieves
    m = ev.match(/revealed thieves from\s+(.+?)\s*\(\d+:\d+\)/i);
    if (m) { const o = m[1].trim(); ag.thief_incidents++; ag.thief_origins[o] = (ag.thief_origins[o]||0)+1; log.push(`Failed thievery attempt by ${o} (prevented)`); continue }
    m = ev.match(/We have found thieves(?: from (.+?) \(\d+:\d+\))?/i);
    if (m) { ag.thief_incidents++; if (m[1]) { const o = m[1].trim(); ag.thief_origins[o] = (ag.thief_origins[o]||0)+1; log.push(`Failed thievery attempt by ${o}`); } else { log.push('Failed thievery attempt by Unknown Province') } continue }

    // Troops found dead
    m = ev.match(/(\d+) of our troops were found dead today/i);
    if (m) { ag.troop_deaths_found += num(m[1]); log.push(`Nightstrike: ${num(m[1])} troops killed`); continue }

    // Battle/raid lines
    if (/^Forces from/i.test(ev)) {
      const mm = ev.match(/Forces from\s+(.+?)\s+came through and ravaged our lands! Their armies killed\s+([\d,]+)\s+of our peasants, thieves, and wizards! We lost\s+(.+)/i);
      if (mm) {
        const attacker = mm[1].trim();
        const civKilled = num(mm[2]);
        ag.civilians_killed += civKilled;
        const lostPart = mm[3];
        const pieces = lostPart.replace(/ and /gi, ', ').split(',').map(s=>s.trim()).filter(Boolean);
        let lossTotal = 0;
        const unitLosses: any = {};
        for (const p of pieces) {
          const m2 = p.match(/([\d,]+)\s+([A-Za-z ]+)/);
          if (!m2) continue;
          const n = num(m2[1]);
          const unit = m2[2].toLowerCase();
          lossTotal += n;
          unitLosses[unit] = (unitLosses[unit]||0)+n;
          if (unit.includes('soldier')) ag.unit_losses.soldiers += n;
          else if (unit.includes('quickblade')) ag.unit_losses.quickblades += n;
          else if (unit.includes('pikeman')||unit.includes('pikemen')) ag.unit_losses.pikemen += n;
          else if (unit.includes('golem')) ag.unit_losses.golems += n;
          else ag.unit_losses.others[unit] = (ag.unit_losses.others[unit]||0)+n;
        }
        recordTop(date, `Raid by ${attacker}`, civKilled + lossTotal);
        // store raid detail
        ag.raids.push({ date, attacker, civKilled, unitLosses });
        // Log incoming massacre with civilian casualties
        log.push(`Incoming massacre from ${attacker}: ${civKilled} peasants killed`);
        continue;
      }
    }

    // Recruits
    m = ev.match(/A new scientist,\s*(.+?)\s*\((.+?)\)/i);
    if (m) { ag.recruits.push({ name: m[1].trim(), field: m[2].trim(), date }); log.push(`New scientist: ${m[1].trim()} (${m[2].trim()})`); continue }

    // Grants / end of war resources
    m = ev.match(/received\s+(\d{1,3}(?:,\d{3})*)\s+free building credits[\s\S]*received\s+(\d{1,3}(?:,\d{3})*)\s+free specialist credits[\s\S]*received\s+(\d{1,3}(?:,\d{3})*)\s+science books/i);
    if (m) { ag.building_credits += num(m[1]); ag.specialist_credits += num(m[2]); ag.books_gained += num(m[3]); log.push(`Unknown event: ${date} ${ev.length>60?ev.slice(0,60)+'...':ev}`); continue }

    // peasants added
    m = ev.match(/(\d{1,3}(?:,\d{3})*) peasants have populated our lands/i);
    if (m) { ag.peasants_added += num(m[1]); log.push(`Unknown event: ${date} ${ev.length>60?ev.slice(0,60)+'...':ev}`); continue }

    // runes stolen
    m = ev.match(/([\d,]+) runes of our runes were stolen/i);
    if (m) { recordTop(date, 'Runes stolen', num(m[1])); log.push(`Stolen runes: ${num(m[1])} runes`); continue }

    // Failed magery attempts (explicit fail line)
    m = ev.match(/Failed magery attempt by\s+(.+?)\s*\(\d+:\d+\)/i);
    if (m) { const who = m[1].trim(); ag.magery_failures[who] = (ag.magery_failures[who]||0)+1; log.push(`Failed magery attempt by ${who}`); continue }
    // Mage noticed possible spell attempts (treat as failed attempts for reporting)
    m = ev.match(/Our mages noticed a possible spell attempt by\s+(.+?)\s+causing trouble/i);
    if (m) { const who = m[1].trim(); ag.magery_failures[who] = (ag.magery_failures[who]||0)+1; log.push(`Failed magery attempt by ${who}`); continue }

    // Generic spell detection using known spell list
    let spellMatched = false;
    for (const sp of SPELLS) {
      const re = new RegExp(sp.pattern, 'i');
      if (re.test(ev)) {
        const name = sp.name;
        ag.mageryEffects[name] = (ag.mageryEffects[name]||0)+1;
        log.push(`${name} spell effect`);
        spellMatched = true;
        break;
      }
    }
    if (spellMatched) continue;

    // Thievery: basic detection and per-operation counting
    let thiefOpMatched = false;
    for (const op of THIEVERY_OPS) {
      const re = new RegExp(op.pattern, 'i');
      if (re.test(ev)) {
        thiefOpMatched = true;
        ag.thief_incidents = (ag.thief_incidents||0) + 1;
        ag.thief_origins['Unknown Province'] = ag.thief_origins['Unknown Province'] || 0; // preserve existing structure
        ag.thievery_ops[op.name] = (ag.thievery_ops[op.name]||0)+1;
        log.push(`Thievery operation detected: ${op.name}`);
        // special-case: towers theft mention -> attribute to Towers origin
        if (/tower/i.test(op.pattern) || /towers?/i.test(ev)) {
          ag.thief_origins['Towers'] = (ag.thief_origins['Towers']||0)+1;
        }
        break;
      }
    }
    if (thiefOpMatched) continue;

    // If nothing matched, push unknown event log
    log.push(`Unknown event: ${date} ${ev.length>60?ev.slice(0,60)+'...':ev}`);
  }

  ag.top_incidents.sort((a: any, b: any) => b.impact - a.impact);

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
    top_thief_origins: Object.entries(ag.thief_origins).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5),
    troop_deaths_found: ag.troop_deaths_found,
    recruits: ag.recruits,
    top_incidents: ag.top_incidents.slice(0,5),
  };

  const pretty = [`Province Summary — ${summary.period}`];
  pretty.push(`Civilians killed: ${summary.civilians_killed}`);
  pretty.push(`Peasants added: ${summary.peasants_added}`);
  pretty.push(`Unit losses: soldiers=${summary.unit_losses.soldiers}, pikemen=${summary.unit_losses.pikemen}, golems=${summary.unit_losses.golems}`);
  pretty.push(`Meteor events: ${summary.meteor_events}`);
  pretty.push(`Gold gained: ${summary.gold_gained}, gold lost to lead: ${summary.gold_lost_to_lead}`);
  pretty.push(`Books gained: ${summary.books_gained}`);
  pretty.push(`Shipments: soldiers=${summary.shipments.soldiers}, gold=${summary.shipments.gold}`);
  pretty.push(`Land gained: ${summary.land_gained}, land lost: ${summary.land_lost}`);
  pretty.push(`Thief incidents: ${summary.thief_incidents}`);
  pretty.push(`Top incidents:`);
  for (const t of summary.top_incidents) pretty.push(`- [${t.date}] ${t.desc} (impact ${t.impact})`);

  // Build formatted summary text
  const formatNumber = (n:number) => n.toLocaleString();

  const nightstrike = ag.troop_deaths_found || 0;
  const landLost = ag.land_lost || 0;
  const meteorTroops = (ag.meteor_kills.peasants||0) + (ag.meteor_kills.soldiers||0) + (ag.meteor_kills.quickblades||0) + (ag.meteor_kills.pikemen||0) + (ag.meteor_kills.golems||0) + Object.values(ag.meteor_kills.others||{}).reduce((s:any,v:any)=>s+v,0);

  // peasants killed in raids (massacres)
  let peasantsMassacred = 0;
  for (const r of ag.raids) {
    peasantsMassacred += (r.civKilled||0);
  }

  // Thievery breakdown
  const thieveryMap: Record<string, number> = {};
  let knownThievesTotal = 0;
  for (const [k,v] of Object.entries(ag.thief_origins||{})) { thieveryMap[k]=v as number; knownThievesTotal += v as number }
  const unknownThieves = (ag.thief_incidents || 0) - knownThievesTotal;
  if (unknownThieves>0) thieveryMap['Unknown Province'] = unknownThieves;

  // Magery failures map
  const mageryMap = ag.magery_failures || {};

  // Received aid
  const aidSoldiers = ag.shipments.soldiers||0;
  const aidGold = ag.shipments.gold||0;

  // Massacre attack listing (preserve original order of ag.raids by impact desc)
  const raidsList = (ag.raids||[]).slice().sort((a:any,b:any)=>b.civKilled - a.civKilled);

  const lines: string[] = [];
  lines.push('💥 Damage');
  lines.push(`Troops Lost (Nightstrike): ${formatNumber(nightstrike)}`);
  lines.push(`Land Lost (Land Lust): ${formatNumber(landLost)} acres`);
  lines.push(`Peasants Killed (Massacres): ${formatNumber(peasantsMassacred)}`);
  lines.push(`Troops Lost (Meteors): ${formatNumber(meteorTroops)}`);
  lines.push('');
  lines.push('🕵️ Thievery Operations');
  lines.push('Failed Thievery Attempts:');
  // sort thieveryMap by count desc
  const thiefEntries = Object.entries(thieveryMap).sort((a,b)=>b[1]-a[1]);
  for (const [k,v] of thiefEntries) lines.push(`${k}: ${v}x`);
  // stolen resources
  if ((ag.top_incidents||[]).some((t:any)=>/Runes stolen/.test(t.desc)) || (ag.top_incidents||[]).length) {
    if ((ag.top_incidents||[]).some((t:any)=>t.desc==='Runes stolen')) {
      // look for stolen runes in top incidents
    }
  }
  if (ag.top_incidents) {
    // detect stolen runes count from recorded top incidents
    const runes = ag.top_incidents.find((t:any)=>/Runes stolen/.test(t.desc));
    if (runes) {
      const m = String(runes.desc).match(/Runes stolen/);
    }
  }
  // explicit stolen runes (we logged in log as Stolen runes)
  const stolenRunesLine = log.find(l=>/^Stolen runes:/i.test(l));
  if (stolenRunesLine) {
    const m = stolenRunesLine.match(/Stolen runes:\s*(\d+)/);
    if (m) lines.push('\nStolen Resources:');
    if (m) lines.push(`Runes: ${m[1]}`);
  }
  lines.push('');
  lines.push('🔮 Spells Operations');
  lines.push('Failed Spells Attempts:');
  for (const [k,v] of Object.entries(mageryMap)) lines.push(`${k}: ${v}x`);
  lines.push(`Spell Effects:`);
  // print all detected spell effects (Pitfalls, Blizzards, Magic Vortex, Meteors, etc.)
  const magEntries = Object.entries(ag.mageryEffects||{});
  if (magEntries.length>0) {
    for (const [k,v] of magEntries) lines.push(`${k}: ${v}x`);
  } else {
    lines.push(`Meteors: ${ag.meteorForecasts || 0}x`);
  }
  lines.push('');
  lines.push('📦 Received Aid');
  lines.push(`soldiers: ${formatNumber(aidSoldiers)}`);
  lines.push(`gold coins: ${formatNumber(aidGold)}`);
  lines.push('');
  lines.push('⚔️ Massacre Attack Results');
  for (const r of raidsList) {
    const attacker = r.attacker;
    lines.push(attacker);
    lines.push(`Lost ${formatNumber(r.civKilled)} peasants, thieves, and wizards`);
    // format unit losses: show soldiers, pikemen, golems if present
    const ul = r.unitLosses || {};
    const soldier = ul['soldiers'] || ul['soldier'] || 0;
    // match pikemen variants
    let pik = 0; let gole = 0; let quick = 0;
    for (const [k,v] of Object.entries(ul)) {
      const key = k.toLowerCase();
      if (key.includes('pik')) pik += v as number;
      else if (key.includes('golem')) gole += v as number;
      else if (key.includes('quick')) quick += v as number;
    }
    const troopParts: string[] = [];
    if (soldier) troopParts.push(`${formatNumber(soldier)} soldiers`);
    if (pik) troopParts.push(`${formatNumber(pik)} Pikemen`);
    if (gole) troopParts.push(`${formatNumber(gole)} Golems`);
    if (quick) troopParts.push(`${formatNumber(quick)} Quickblades`);
    if (troopParts.length>0) lines.push(`Troops lost: ${troopParts.join(', ')}`);
  }
  lines.push('');
  lines.push('✨ Other Events');
  lines.push(`New Scientists: ${ag.recruits.length}x`);

  const formatted = lines.join('\n');

  return { text: pretty.join('\n'), json: summary, log, formatted };
}

export default parseProvinceNews;
