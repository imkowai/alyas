import test from 'node:test';
import assert from 'node:assert/strict';
import {weights,TIERS} from '../src/rarity.js';
test('all fifteen tiers have positive integer weights',()=>{
  assert.equal(TIERS.length,15);
  for(const x of weights())assert.ok(x.weight>0n);
});
test('tier weights descend',()=>{
  const w=weights();
  for(let i=1;i<w.length;i++)assert.ok(w[i-1].weight>w[i].weight);
});
