const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function hookHarness(fetch) {
  let state, effect, cleanup, dependencies;
  const compiled=ts.transpileModule(fs.readFileSync('src/app/intel/useLiveIntel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports','fetch',compiled)(name=>name==='react'?{
    useState:initial=>{if(state===undefined)state=initial;return[state,value=>{state=value;}];},
    useEffect:(fn,deps)=>{if(!dependencies||deps.some((v,i)=>v!==dependencies[i])){effect=fn;dependencies=deps;}},
  }:require(name),m,m.exports,fetch);
  return {
    render(url,revision=0){const result=m.exports.useLiveIntel(url,revision);if(effect){cleanup?.();const next=effect;effect=undefined;cleanup=next();}return result;},
    dispose(){cleanup?.();},
  };
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('section and target changes clear data immediately, abort old requests and ignore late responses',async()=>{
  const pending=[];
  const h=hookHarness((url,options)=>new Promise(resolve=>pending.push({url,options,resolve})));
  h.render('/api/kingdom-intel?location=5:11');
  assert.equal(pending[0].options.cache,'no-store');
  assert.equal(h.render('/api/kingdom-intel?location=6:7').data,null);
  assert.equal(pending[0].options.signal.aborted,true);
  pending[1].resolve(Response.json({kingdom:{location:'6:7'}}));await flush();
  assert.equal(h.render('/api/kingdom-intel?location=6:7').data.kingdom.location,'6:7');
  pending[0].resolve(Response.json({kingdom:{location:'5:11'}}));await flush();
  assert.equal(h.render('/api/kingdom-intel?location=6:7').data.kingdom.location,'6:7');
  h.dispose();
});
test('refresh makes a fresh request for an unchanged URL and never displays the previous data as current',async()=>{
  const pending=[];const h=hookHarness((url,options)=>new Promise(resolve=>pending.push({url,options,resolve})));
  h.render('/api/intel-data?resource=recent');pending[0].resolve(Response.json({data:[1]}));await flush();
  assert.deepEqual(h.render('/api/intel-data?resource=recent').data.data,[1]);
  const refreshed=h.render('/api/intel-data?resource=recent',1);assert.equal(refreshed.data,null);assert.equal(refreshed.loading,true);assert.equal(pending.length,2);
  pending[1].resolve(Response.json({data:[2]}));await flush();
  assert.deepEqual(h.render('/api/intel-data?resource=recent',1).data.data,[2]);h.dispose();
});
test('API errors render without retaining results from another selection',async()=>{
  const h=hookHarness(async()=>Response.json({error:'No access to this server'},{status:403}));
  h.render('/api/intel-data?server=2');await flush();const state=h.render('/api/intel-data?server=2');assert.equal(state.loading,false);assert.equal(state.data,null);assert.equal(state.error,'No access to this server');h.dispose();
});
