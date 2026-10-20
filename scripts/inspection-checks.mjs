import assert from 'node:assert/strict';
import { World } from '../build/world/world.js';
import { TRAIT, TRAIT_COUNT } from '../build/bio/genome.js';
import { cellAt, inspectCell } from '../build/app/inspection.js';
import { hitInspectionCell, inspectionHeatmap } from '../build/app/main.js';

const w = new World({config:{founders:12,seed:517,worldW:800,worldH:600}});
const cols=w.nutrients[0].cols,rows=w.nutrients[0].rows;
assert.equal(cellAt(w,0,0),0);
assert.equal(cellAt(w,800,600),cols*rows-1);
assert.equal(cellAt(w,-10,-20),0);
assert.equal(cellAt(w,800/cols,600/rows),cols+1);
assert.equal(hitInspectionCell({world:w,seed:517},1,1),cols*rows-1);
assert.throws(()=>cellAt(w,NaN,0));
assert.throws(()=>inspectCell(w,-1));
assert.throws(()=>inspectCell(w,0.5));
const before=w.hashState();
for(let cell=0;cell<cols*rows;cell++){
 const d=inspectCell(w,cell);
 for(let p=0;p<3;p++)assert.equal(d.nutrients[p].capacity,
  w.config.nutrientPerCell*w.habitat.fertility.data[cell]*w.config.nutrientCapacity[p]);
 assert.equal(d.photosynthesisLimitation.evidence,'not_observed');
 assert.equal(d.tick,0);
}
const snapshot=inspectCell(w,0);snapshot.resolvedConfig.nutrientCapacity[0]=999;
assert.notEqual(w.config.nutrientCapacity[0],999);
for(let p=0;p<3;p++)assert.equal(inspectionHeatmap({world:w,seed:517},p).length,cols*rows);
assert.equal(w.hashState(),before,'all inspection and export reads must preserve state+RNG');
assert.deepEqual(inspectCell(w,0),inspectCell(w,0),'paused reads stable');
w.step();assert.equal(inspectCell(w,0).tick,1,'stepped read refreshes');
const empty=new World({config:{founders:0,worldW:800,worldH:600}});
assert.deepEqual(inspectCell(empty,0).displayedGuilds,{producers:0,consumers:0,decomposers:0});
// Synthetic expressed traits demonstrate that capability is NOT assigned from
// cached displayed guild. The fixture mutates setup; the reader must not.
const slot=0,cell=cellAt(w,w.store.x[slot],w.store.y[slot]);
const set=(t,v)=>{w.store.physical[slot*TRAIT_COUNT+t]=v;};
set(TRAIT.PHOTOSYNTHETIC_RATE,0);set(TRAIT.CARRION_AFFINITY,0);
set(TRAIT.RECALCITRANT_DIGESTION,1);
const guild=w.roleOf(slot).trophic;
const setupHash=w.hashState();
assert.ok(inspectCell(w,cell).expressedCapabilities.recalcOnly>=1);
assert.equal(w.roleOf(slot).trophic,guild);
assert.equal(w.hashState(),setupHash);
console.log('PASS inspection: boundaries, caps, empty/no-observer, capability vs guild, pause/step, detached export, state/RNG parity.');
