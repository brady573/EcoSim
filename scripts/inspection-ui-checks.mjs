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
const scope={window,document:doc,performance:{now:()=>100},
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
console.log('PASS shipped bundle UI: pointer/touch handler, arrows, numeric selection, export, heatmap, paused tick stability and +100 refresh.');
