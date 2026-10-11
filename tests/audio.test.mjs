import test from 'node:test';
import assert from 'node:assert/strict';
import {audioDefaults,audioSettings,audioOutputName,outputSamples} from '../lib/audio-settings.mjs';
test('audio settings reject invalid values before browser allocation',()=>{
 for(const [key,values] of Object.entries({speed:[NaN,Infinity,0,.49,4.1,'2'],gain:[NaN,-21,21],maxDuration:[0,1201,Infinity]}))for(const value of values)assert.throws(()=>audioSettings({...audioDefaults,[key]:value}));
 assert.deepEqual(audioSettings(audioDefaults),{speed:2.3,gain:-4,maxDuration:350,format:"ogg",bitrate:128});
});
test('output names are safe and bounded while keeping the source name',()=>{
 assert.equal(audioOutputName('my.track.mp3'),'my.track.ogg');
 assert.equal(audioOutputName('../unsafe:name?.wav'),'.._unsafe_name_.ogg');
 assert.ok(audioOutputName('a'.repeat(500)+'.wav').length<=154);
 assert.equal(outputSamples(480000,2),240000);
 assert.equal(outputSamples(480000,.5),960000);
});

import {audioLink} from '../lib/audio-link.mjs';
test('audio URL admission rejects spoofed domains and credentials',()=>{
 for(const link of ['http://youtube.com/watch?v=x','https://youtube.com.evil.test/x','https://user:secret@youtube.com/x','https://127.0.0.1/a.mp3','https://youtube.com:8443/x'])assert.throws(()=>audioLink(link));
 for(const link of ['https://youtu.be/abc','https://vm.tiktok.com/abc/','https://www.instagram.com/reel/abc/','https://www.facebook.com/reel/123','https://x.com/user/status/123','https://soundcloud.com/user/track'])assert.equal(audioLink(link).kind,'social');
 assert.equal(audioLink('https://cdn.example.com/song.mp3?signature=1').kind,'direct');
 for(const format of ['mp3','ogg','wav'])assert.equal(audioOutputName('track.wav',format),'track.'+format);
 assert.throws(()=>audioSettings({...audioDefaults,format:'exe'}));assert.throws(()=>audioSettings({...audioDefaults,bitrate:999}));
});
