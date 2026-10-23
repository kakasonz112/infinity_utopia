const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup:render}=require('react-dom/server');
const css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
function page(split,section='provinces'){
  let index=0;const values=[section,'enemy','6:7','6','7',0,true,split],urls=[];
  const modules={
    react:{...React,useState:initial=>[index<values.length?values[index++]:initial,()=>{}],useEffect:()=>{}},
    './KingdomView':{__esModule:true,default:({side})=>React.createElement('div',{'data-side':side},side)},
    './ResourcePanel':{__esModule:true,default:({side})=>React.createElement('div',{'data-resource-side':side},side),FetchStatus:()=>null,LoadingData:()=>null,sectionNames:{provinces:'Provinces',archive:'Province history','war-plan':'War plans',recent:'Recent intel'}},
    './useLiveIntel':{useLiveIntel:url=>{urls.push(url);return{data:{own:{kingdom:{location:'5:9'}},enemy:{kingdom:{location:'6:7'}}},loading:false,error:'',fetchedAt:''};}},
    './BattleOverview':{__esModule:true,default:()=>React.createElement('div',{'data-battle':true},'Comparison')},
  };
  const workspace={exports:{}};new Function('require','module','exports',transpile('src/app/intel/ProvinceWorkspace.tsx'))(name=>name.endsWith('.css')?css:modules[name]??require(name),workspace,workspace.exports);modules['./ProvinceWorkspace']=workspace.exports;
  const m={exports:{}};new Function('require','module','exports',transpile('src/app/intel/page.tsx'))(name=>name.endsWith('.css')?css:modules[name]??require(name),m,m.exports);
  return{html:render(React.createElement(m.exports.default)),urls};
}
test('split view requests both sides for the selected target and exposes two independent panes',()=>{const{html,urls}=page(true);assert.match(html,/Own kingdom pane/);assert.match(html,/Enemy kingdom pane/);assert.match(html,/class="splitGrid"/);assert.equal(urls.length,1);assert.match(html,/data-side="own"/);assert.match(html,/data-side="enemy"/);assert.match(html,/data-battle="true"/);assert.ok(urls.every(url=>new URL('http://local'+url).searchParams.get('location')==='6:7'));});
test('disabling split renders only the selected kingdom',()=>{const{html,urls}=page(false);assert.doesNotMatch(html,/class="splitGrid"/);assert.equal(urls.length,1);assert.match(html,/data-side="enemy"/);assert.doesNotMatch(html,/data-side="own"/);});
test('archive and saved plans also support own/enemy split, while shared recent intel stays single',()=>{for(const section of ['archive','war-plan']){const{html}=page(true,section);assert.match(html,/data-resource-side="own"/);assert.match(html,/data-resource-side="enemy"/);}assert.doesNotMatch(page(true,'recent').html,/class="splitGrid"/);});
function highlightsHarness(storage){let state,dependency,effect;const m={exports:{}};const react={useState:initial=>{state??=initial;return[state,value=>state=typeof value==='function'?value(state):value];},useEffect:(fn,deps)=>{if(dependency!==deps[0]){dependency=deps[0];effect=fn;}}};new Function('require','module','exports','localStorage',transpile('src/app/intel/useRowHighlights.ts'))(name=>name==='react'?react:require(name),m,m.exports,storage);return name=>{const result=m.exports.useRowHighlights(name);if(effect){const fn=effect;effect=null;fn();}return result;};}
test('highlights toggle independently per kingdom and side, persist on remount and can be cleared',()=>{const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let h=highlightsHarness(storage);h('1:own:5:9').toggle(11);h('1:own:5:9').toggle(2);assert.equal(h('1:own:5:9').size,2);assert.equal(h('1:enemy:5:11').has(11),false);h('1:enemy:5:11').toggle(4);assert.equal(h('1:own:5:9').has(4),false);h=highlightsHarness(storage);h('1:own:5:9');assert.equal(h('1:own:5:9').has(11),true);h('1:own:5:9').toggle(11);assert.equal(h('1:own:5:9').has(11),false);h('1:own:5:9').clear();assert.equal(h('1:own:5:9').size,0);});
