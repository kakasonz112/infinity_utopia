const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
let state=[],index=0;
const source=fs.readFileSync('src/app/intel/KingdomView.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;

let customColumns=null;
const markedRows=new Set();
const columnModule={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/app/intel/ColumnPicker.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(name=>name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(name),columnModule,columnModule.exports);
const columnTools={__esModule:true,...columnModule.exports,useColumnLayout:(name,defaults)=>({selected:customColumns??defaults,change:()=>{}})};


const combatModule={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/app/intel/combatModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,combatModule,combatModule.exports);
const battleModule={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/app/intel/BattleOverview.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(name=>name==='./combatModel'?combatModule.exports:name==='./DragScroll'?{__esModule:true,default:({children,...props})=>React.createElement('div',props,children)}:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(name),battleModule,battleModule.exports);

const loaded={exports:{}};
new Function('require','module','exports',compiled)(name=>name==='react'?{...React,useState:initial=>[index<state.length?state[index++]:initial,()=>{}],useMemo:fn=>fn()}:name==='./useFrozenColumns'?{useFrozenColumns:()=>null}:name==='./combatModel'?combatModule.exports:name==='./BattleOverview'?battleModule.exports:name==='./useRowHighlights'?{useRowHighlights:()=>({has:id=>markedRows.has(id),toggle:id=>markedRows.has(id)?markedRows.delete(id):markedRows.add(id),size:markedRows.size,clear:()=>markedRows.clear()})}:name==='./ColumnPicker'?columnTools:name==='./DragScroll'?{__esModule:true,default:({children,...props})=>React.createElement('div',props,children)}:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(name),loaded,loaded.exports);
const provinces=[{id:11,name:'Almost Invincible',race:'Elf',land:500,networth:100000,sot:{personality:'Sage',ageSeconds:100,goodSpells:[{name:'Magic Shield',ticks:0}],badSpells:[],cooldown:[]},som:{ageSeconds:200,standingArmy:{generals:2,solds:42,oSpecs:123,elites:44,horses:300},training:{totalTraining:12},armiesAway:[{generals:1,solds:12,oSpecs:200,elites:300,horses:100,land:20,secondsRemaining:7200}]},survey:{buildingEff:.91,buildings:[{name:'Banks',pctCurr:5,pctInc:2,pctTot:7}]},sos:{allocatedBooks:1000,unallocatedBooks:200,books:[{type:'Alchemy',effect:4.7},{type:'Tools',effect:0}]}},{id:2,name:'Other Province',race:'Human',land:300,networth:50000,survey:{buildingEff:.9,buildings:[{name:'Banks',pctCurr:12,pctInc:1,pctTot:13}]}}];
function page(view='Overview',overrides={}){state=['','','','','','',view,{key:'name',descending:false},null,'pctCurr'];for(const [key,value]of Object.entries(overrides))state[Number(key)]=value;index=0;return renderToStaticMarkup(React.createElement(loaded.exports.default,{result:{kingdom:{kingdomName:'Example',location:'5:9',provinces},response:null,error:null},side:'own'}));}
test('province ID is a separate sortable column, not part of its name button',()=>{const html=page('Overview',{7:{key:'id',descending:false}});assert.match(html,/>#<span/);assert.match(html,/<td class="idCell"[^>]*>11<\/td><th scope="row"[^>]*><div class="provinceIdentity"><button[^>]*>[\s\S]*?<button class="provinceButton"[^>]*><span>Almost Invincible/);assert.ok(html.indexOf('<td class="idCell" data-frozen="id">2<')<html.indexOf('<td class="idCell" data-frozen="id">11<'));assert.doesNotMatch(html,/class="slot"/);});
test('army tab shows home troops and return times, with full per-army details on expansion',()=>{const html=page('Army',{8:11});assert.match(html,/Soldiers home/);assert.match(html,/2h 0m/);assert.match(html,/Standing Army/);assert.match(html,/Armies Away/);assert.match(html,/Seconds Remaining/);});
test('spell view shows names and zero-tick durations and distinguishes missing intel from empty lists',()=>{const html=page('Spells');assert.match(html,/Magic Shield/);assert.match(html,/0 ticks/);assert.match(html,/>None</);assert.match(html,/>No intel</);});
test('survey columns sort by the selected current, incoming or total percentage',()=>{for(const [metric,expected]of [['pctCurr','5%'],['pctInc','2%'],['pctTot','7%']]){const html=page('Survey',{9:metric,7:{key:'building:Banks',descending:false}});assert.match(html,/Banks/);assert.ok(html.includes(expected));const first=metric==='pctInc'?'2':'11';assert.match(html,new RegExp('<tbody><tr[^>]*><td class="idCell"[^>]*>'+first+'<'));}assert.match(page('Survey'),/91%/);});
test('science displays categories, real zero effects and focused full-report details',()=>{const html=page('Science',{8:11});assert.match(html,/Allocated books/);assert.match(html,/Alchemy/);assert.match(html,/4.7%/);assert.match(html,/0%/);assert.match(html,/Science details/);assert.match(html,/Science intel/);});

test('all armies away appear as separate rows without expanding the province or combining return times',()=>{
  const original=provinces[0].som.armiesAway;
  provinces[0].som.armiesAway=[
    {generals:1,solds:12,oSpecs:200,elites:300,horses:100,land:20,secondsRemaining:7200},
    {generals:2,solds:34,oSpecs:400,elites:600,horses:200,land:40,secondsRemaining:14400},
    {generals:1,solds:0,oSpecs:200,elites:300,horses:100,land:0,secondsRemaining:7201},
  ];
  try {
    const html=page('Army');
    assert.match(html,/<th scope="row">Army 1<\/th>/);
    assert.match(html,/<th scope="row">Army 2<\/th>/);
    assert.match(html,/<th scope="row">Army 3<\/th>/);
    assert.match(html,/2h 0m 0s/);assert.match(html,/4h 0m 0s/);assert.match(html,/2h 0m 1s/);
    assert.match(html,/<th scope="row">Army 2<\/th><td>2<\/td><td>34<\/td><td>400<\/td><td>600<\/td><td>200<\/td><td[^>]*>40<\/td>/);
    assert.doesNotMatch(html,/Next return/);
    assert.match(html,/Away-army intel unavailable/);
    provinces[0].som.armiesAway=[];
    assert.match(page('Army'),/No armies away/);
  } finally { provinces[0].som.armiesAway=original; }
});
test('overview shows offense and defense ratios, separate army returns and home points',()=>{
  const p=provinces[0], original={sot:p.sot,som:p.som,calcs:p.calcs};
  p.sot={...p.sot,offPoints:53764,opa:124,defPoints:19526,dpa:45};
  p.som={...p.som,offPointsHome:3004,defPointsHome:19000,armiesAway:[{secondsRemaining:26700,land:58},{secondsRemaining:26940,land:60}]};
  p.calcs={defPointsSummary:{defPointsHome:19526}};
  try{const html=page();assert.match(html,/Off \(opa\)/);assert.match(html,/Def \(dpa\)/);assert.match(html,/53.8k \(124\)/);assert.match(html,/19.5k \(45\)/);assert.match(html,/class="returnTime">7h25/);assert.match(html,/class="incomingLand">\(58a\)/);assert.match(html,/class="returnTime">7h29/);assert.match(html,/class="incomingLand">\(60a\)/);assert.match(html,/Def Home/);assert.match(html,/Off Home/);assert.match(html,/>3k</);assert.doesNotMatch(html,/>19,000</);}
  finally{p.sot=original.sot;p.som=original.som;p.calcs=original.calcs;}
});

test('overview can mix fields from economy, military, spells, science and survey and hide default columns',()=>{
  customColumns=['name','sot.money','som.standingArmy.generals','sot.goodSpells','science:Alchemy','buildingMetric:pctTot:Banks'];
  try{
    const html=page('Overview');
    const table=html.slice(html.indexOf('<table class="provinceTable">'));
    assert.doesNotMatch(table,/<td class="idCell"[^>]*>/);
    assert.match(table,/Gold/);assert.match(table,/Generals home/);assert.match(table,/Magic Shield/);assert.match(table,/Alchemy/);assert.match(table,/4.7%/);assert.match(table,/Banks \(Total\)/);assert.match(table,/7%/);
    assert.doesNotMatch(table,/>NW \/ acre</);
  }finally{customColumns=null;}
});
test('individual army columns can be chosen in overview without combining armies',()=>{
  customColumns=['name','away:secondsRemaining','away:land'];
  try{const html=page('Overview');const table=html.slice(html.indexOf('<table class="awayArmyTable">'));assert.match(table,/Return in/);assert.match(table,/Returning acres/);assert.match(table,/Army 1/);assert.doesNotMatch(table,/<th scope="col">Generals/);}finally{customColumns=null;}
});
test('highlighted province and its away-army rows share a highlight and expose a toggle',()=>{
  markedRows.add(11);
  try{const html=page('Army');assert.match(html,/data-highlighted="true"/);assert.match(html,/<tr class="armyGroupRow"[^>]*data-highlighted="true"/);assert.match(html,/aria-label="Highlight #11 Almost Invincible" aria-pressed="true"/);assert.match(html,/Clear highlights \(1\)/);assert.match(html,/aria-label="Highlight #2 Other Province" aria-pressed="false"/);}finally{markedRows.clear();}
});
