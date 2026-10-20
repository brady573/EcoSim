/** Historical false-equality reproduction using the actual old hash method. */
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { World } from '../build/world/world.js';
import { RollingDigest } from '../build/core/hash.js';
import { TRAIT_COUNT } from '../build/bio/genome.js';
const source=execFileSync('git',['show','06be7da:src/world/world.ts'],{encoding:'utf8'});
const start=source.indexOf('  hashState(): string {');
const end=source.indexOf('\n  }',start)+4;
assert.ok(start>0&&end>start);
const method=source.slice(start,end).replace('hashState(): string','function()');
const oldHash=runInNewContext('('+method+')',{RollingDigest,TRAIT_COUNT});
const w=new World({config:{founders:4,seed:517,genomeV2:true,nutrientCyclic:true,
 pioneerBonus:{grace:20,discount:0.5}}});
assert.ok(w.store.moduleCount[0]>0);
for(const [name,target] of [
 ['fatigue',w.store.fatigue], ['geneModules',w.store.geneModules],
 ['pioneerTicks',w.pioneerTicks], ['pioneerVoid',w.pioneerVoid],
 ['mineralisedCell',w.mineralisedCell],
]){
 const oldBefore=oldHash.call(w),newBefore=w.hashState(),saved=target[0];
 target[0]=saved+1;
 assert.equal(oldHash.call(w),oldBefore,`historical hash should miss ${name}`);
 assert.notEqual(w.hashState(),newBefore,`new hash must detect ${name}`);
 target[0]=saved;assert.equal(w.hashState(),newBefore);
 console.log(`PASS ${name}: old digest falsely equal; world-state/2 detects mutation and exact restoration`);
}
