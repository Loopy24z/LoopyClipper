import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionScale} from '../lib/motion.mjs';
import {validateClip} from '../lib/domain.mjs';
import {templateSettings} from '../lib/template-settings.mjs';
const clip={title:'Test',description:'',start:0,end:10,ratio:'9:16',fit:'cover',position:50,captions:true,fontSize:36,color:'#ffffff',background:'#000000'};
test('motion follows bounded output-time curves and old clips remain static',()=>{
 assert.equal(motionScale('none',4),1);assert.equal(validateClip(clip,10).motion,'none');
 assert.equal(motionScale('opening',0),1.1);assert.equal(motionScale('opening',3),1);
 assert.equal(motionScale('rhythm',3.99),1);assert.equal(motionScale('rhythm',4),1.1);
 for(const mode of ['opening','subtle','rhythm'])for(let t=0;t<60;t+=.03){const scale=motionScale(mode,t,.16);assert.ok(scale>=1&&scale<=1.160001);}
 assert.equal(templateSettings({...clip,motion:'subtle',motionAmount:.08}).motion,'subtle');
 for(const v of [{motion:'bad'},{motionAmount:NaN},{motionAmount:.8}])assert.throws(()=>validateClip({...clip,...v},10));
});
