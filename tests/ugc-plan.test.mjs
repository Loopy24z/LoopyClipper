import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCreativePlan} from '../lib/ugc-plan-domain.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/ugc-plan.json',import.meta.url),'utf8'));
test('creative plans accept bounded layouts and strip arbitrary model fields',()=>{
 const result=validateCreativePlan({...fixture,code:'do not execute',url:'https://bad.test'});
 assert.equal(result.scenes[0].layout,'hero');assert.equal(result.scenes.at(-1).layout,'cta');assert.equal(result.code,undefined);assert.equal(result.url,undefined);
 for(const modify of [p=>p.scenes[0].layout='movie=http://bad',p=>p.scenes[0].seconds=99,p=>p.scenes[0].displayText='a'.repeat(101),p=>p.palette='url(http://bad)',p=>p.scenes=[],p=>p.scenes.at(-1).layout='hero']){const p=structuredClone(fixture);modify(p);assert.throws(()=>validateCreativePlan(p));}
});
