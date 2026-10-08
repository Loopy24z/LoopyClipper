import {test} from 'node:test';
import assert from 'node:assert/strict';
import {templateSettings} from '../lib/template-settings.mjs';
import {captionPresets} from '../lib/editing.mjs';
const base={ratio:'9:16',fit:'cover',position:50,captions:true,fontSize:52,color:'#ffffff',background:'#000000'};
test('templates contain reusable style only, never source text or cuts',()=>{
 const saved=templateSettings({...base,title:'Private title',captionText:'Private speech',headline:'Private headline',start:100,end:130,segments:[{start:100,end:120}],reason:'Private reason',owner:'other'});
 for(const key of ['title','captionText','headline','start','end','segments','reason','owner'])assert.equal(key in saved,false);
 assert.equal(saved.headlineEnabled,false);
 assert.throws(()=>templateSettings({...base,fontSize:500}));
 assert.throws(()=>templateSettings({...base,color:'red'}));
});
test('all 15 visual presets use valid render settings',()=>{
 assert.equal(captionPresets.length,15);
 assert.equal(new Set(captionPresets.map(p=>p.id)).size,15);
 for(const preset of captionPresets){const style=templateSettings({...base,...preset});assert.equal(style.textEffect,preset.textEffect);assert.equal(style.color,preset.color);}
});
