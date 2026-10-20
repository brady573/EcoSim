// Execute the shipped file:// scripts against a small DOM/canvas adapter.
// This is interaction/bundle smoke, NOT a real-browser screenshot claim.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
 putImageData(){},save(){},restore(){},drawImage(){},strokeRect(){}};
const make=()=>({value:'',disabled:false,checked:false,textContent:'',style:{},
 width:600,height:600,getContext:()=>context,
 getBoundingClientRect:()=>({left:10,top:20,width:300,height:300}),
 select(){},click(){},scrollIntoView(){}});
for(const id of ['cv','seed','run','pause','step','speed','mode','readout','inspectmode','pool',
 'cellx','celly','selectcell','exportcell','cellreadout','dump','dumptext','export'])elements.set(id,make());
const el=id=>elements.get(id);
el('seed').value='517';el('mode').value='base';el('speed').value='40';el('pool').value='-1';
const doc={getElementById:el,createElement:make};
const window={};const callbacks=new Map();let next=1;
let clock=100;
const scope={window,document:doc,performance:{now:()=>clock},
 requestAnimationFrame:f=>{callbacks.set(next,f);return next++;},
 cancelAnimationFrame:id=>callbacks.delete(id),Uint8Array,Uint8ClampedArray,
 Float32Array,Float64Array,Int32Array,Uint32Array,Uint16Array,Int16Array,
 Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 navigator:{},setTimeout:f=>f(),console};
// window.SimApp and the shell's bare SimApp refer to the same browser global.
const browser=createContext(scope);
const html=readFileSync('build/legacy-viewer.html','utf8');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))runInContext(match[1],browser);
el('run').onclick();el('pause').onclick(); // Freeze before inspecting.
el('inspectmode').checked=true;
el('cv').onpointerdown({clientX:310,clientY:320});
el('exportcell').onclick();
let d=JSON.parse(el('dumptext').value);
const tick=d.tick;
assert.equal(d.column,59);assert.equal(d.row,59); // 2400 / fieldCell40
el('cv').onkeydown({key:'ArrowLeft',preventDefault(){}});
el('exportcell').onclick();d=JSON.parse(el('dumptext').value);
assert.equal(d.column,58);assert.equal(d.tick,tick);
el('cellx').value='0';el('celly').value='0';el('selectcell').onclick();
el('exportcell').onclick();assert.equal(JSON.parse(el('dumptext').value).cell,0);
el('pool').value='2';el('pool').onchange();
assert.match(el('cellreadout').textContent,/not observed/);
doc.activeElement=el('cellx');el('cellx').value='12';
el('pool').onchange();assert.equal(el('cellx').value,'12','refresh preserves active numeric edit');
doc.activeElement=null;
el('cellx').value='';el('selectcell').onclick();
assert.match(el('cellreadout').textContent,/integer column/,'blank coordinate is rejected');
el('cellx').value='0';el('celly').value='0';el('selectcell').onclick();
el('step').onclick();el('exportcell').onclick();d=JSON.parse(el('dumptext').value);
assert.equal(d.tick,tick+100);
el('cellx').value='-1';el('selectcell').onclick();
assert.match(el('cellreadout').textContent,/integer column/);

// Live animation regression: census scans must belong to the existing HUD,
// never to an inactive/throttled inspector. Record actual API calls, not source
// text, while executing the shipped requestAnimationFrame callbacks.
const api=scope.SimApp;
let readCalls=0, inspectionCalls=0, heatCalls=0, lastAlpha=null, liveHandle;
for(const [name,onCall] of [
 ['readRun',()=>{readCalls++;}], ['inspectRunCell',()=>{inspectionCalls++;}],
 ['inspectionHeatmap',()=>{heatCalls++;}], ['renderLerp',(_handle,alpha)=>{lastAlpha=alpha;}],
]){
 const original=api[name];
 api[name]=(...args)=>{onCall(...args);return original(...args);};
}
const originalCreate=api.createRun;
api.createRun=(...args)=>{liveHandle=originalCreate(...args);return liveHandle;};
const frameAt=time=>{
 clock=time;
 const entry=callbacks.entries().next().value;
 assert.ok(entry,'expected an advancing animation frame');
 callbacks.delete(entry[0]);entry[1](time);
};
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
clock=1000;el('pool').value='-1';el('run').onclick();
const initialReads=readCalls,initialInspections=inspectionCalls,initialHeat=heatCalls;
for(const time of [1016,1032,1048])frameAt(time);
expect(readCalls-initialReads===3,'inactive inspector adds census scans beyond one HUD read per committed frame');
expect(inspectionCalls===initialInspections&&heatCalls===initialHeat,'inactive inspector performs aggregation');
const frameAlpha=lastAlpha;
assert.equal(frameAlpha,0,'commit-frame fixture should render the start of interpolation');
const beforeSelection=liveHandle.world.hashState();
el('cv').onpointerdown({clientX:160,clientY:170});
expect(lastAlpha===frameAlpha,'live cell selection did not preserve the commit-frame alpha');
expect(liveHandle.world.hashState()===beforeSelection,'selection changes authoritative state');
const selectedReads=readCalls,selectedInspections=inspectionCalls;
for(const time of [1064,1080,1096])frameAt(time);
expect(readCalls-selectedReads===3,'throttled playback census count differs from one HUD read per frame');
expect(inspectionCalls===selectedInspections,'selected-cell aggregation bypasses 250ms throttle');
const heatAlpha=lastAlpha,beforeHeat=liveHandle.world.hashState();
el('pool').value='1';el('pool').onchange();
expect(lastAlpha===heatAlpha,'live heatmap change did not preserve the rendered alpha');
expect(liveHandle.world.hashState()===beforeHeat,'heatmap change mutates authoritative state');
const heatReads=readCalls,heatScans=heatCalls,cellScans=inspectionCalls;
frameAt(1112);
expect(readCalls-heatReads===1,'heatmap inspector adds census scans inside throttle window');
expect(heatCalls===heatScans&&inspectionCalls===cellScans,'heatmap/cell aggregation bypasses throttle');
frameAt(1400);
expect(heatCalls===heatScans+1&&inspectionCalls===cellScans+1,'active inspector does not refresh after throttle window');
el('pause').onclick();
expect(lastAlpha===1,'paused view must use the latest committed state');
// Exercise a genuinely fractional in-between frame, not only alpha=0 at
// commits. Simulate one expensive batch in the wall clock (not in biology),
// causing the existing scheduler to spread subsequent steps over frames.
const originalStep=api.stepRun;let simulatedCost=400;
api.stepRun=(...args)=>{const value=originalStep(...args);clock+=simulatedCost;simulatedCost=0;return value;};
clock=2000;el('pool').value='-1';el('run').onclick();
for(const time of [2016,2432,2448,2464])frameAt(time);
const fractionalAlpha=lastAlpha;
expect(fractionalAlpha>0&&fractionalAlpha<1,'fixture failed to reach a fractional interpolation frame');
const fractionalState=liveHandle.world.hashState();
el('cv').onpointerdown({clientX:160,clientY:170});
expect(lastAlpha===fractionalAlpha,'selection does not preserve a fractional interpolation state');
el('pool').value='2';el('pool').onchange();
expect(lastAlpha===fractionalAlpha,'heatmap switch does not preserve a fractional interpolation state');
expect(liveHandle.world.hashState()===fractionalState,'fractional-frame redraw changes authoritative state');
el('pause').onclick();expect(lastAlpha===1,'fractional playback pause must show committed positions');
assert.deepEqual(failures,[],'live-playback regressions');
console.log('PASS shipped bundle UI: pointer/keyboard/export/pause/step plus live census-throttling, inactive fast path and interpolation preservation.');
