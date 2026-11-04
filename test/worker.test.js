import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
test('health endpoint lists commands without exposing secrets',async()=>{
 const r=await worker.fetch(new Request('https://alyas.test/health'),{}, {});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.name,"Alya's");
 assert.equal(data.configured,false);
 assert.ok(data.commands.includes('roll'));
 assert.ok(data.commands.includes('boosts'));
});
test('unconfigured webhook does not accept an unsigned request',async()=>{
 const r=await worker.fetch(new Request('https://alyas.test/webhook',{method:'POST',body:'{}'}),{}, {});
 assert.equal(r.status,503);
});
test('unknown routes do not return application data',async()=>{
 const r=await worker.fetch(new Request('https://alyas.test/does-not-exist'),{}, {});
 assert.equal(r.status,404);
});