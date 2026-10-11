import test from 'node:test';
import assert from 'node:assert/strict';
import {audioDefaults,audioSettings,audioOutputName,outputSamples} from '../lib/audio-settings.mjs';
test('audio settings reject invalid values before browser allocation',()=>{
 for(const [key,values] of Object.entries({speed:[NaN,Infinity,0,.49,4.1,'2'],gain:[NaN,-21,21],maxDuration:[0,1201,Infinity]}))for(const value of values)assert.throws(()=>audioSettings({...audioDefaults,[key]:value}));
 assert.deepEqual(audioSettings(audioDefaults),{speed:2.3,gain:-4,maxDuration:350});
});
test('output names are safe and bounded while keeping the source name',()=>{
 assert.equal(audioOutputName('my.track.mp3'),'my.track.ogg');
 assert.equal(audioOutputName('../unsafe:name?.wav'),'.._unsafe_name_.ogg');
 assert.ok(audioOutputName('a'.repeat(500)+'.wav').length<=154);
 assert.equal(outputSamples(480000,2),240000);
 assert.equal(outputSamples(480000,.5),960000);
});
