import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creditDay,creditCost,youtubeVideo} from '../lib/credits-domain.mjs';
test('daily credits turn over at midnight Jakarta',()=>{assert.equal(creditDay(Date.parse('2026-09-14T16:59:59Z')),'2026-09-14');assert.equal(creditDay(Date.parse('2026-09-14T17:00:00Z')),'2026-09-15');});
test('charge by started source minute',()=>{assert.equal(creditCost(60),1);assert.equal(creditCost(61),2);assert.throws(()=>creditCost(0));assert.throws(()=>creditCost(3601));});
test('only individual YouTube HTTPS video URLs',()=>{assert.equal(youtubeVideo('https://youtu.be/abcdefghijk?t=2'),'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(youtubeVideo('https://www.youtube.com/shorts/abcdefghijk'),'https://www.youtube.com/watch?v=abcdefghijk');for(const s of ['http://youtube.com/watch?v=abcdefghijk','https://evil.test/watch?v=abcdefghijk','https://youtube.com/playlist?list=foo','https://youtube.com/watch?v=abcdefghijk&list=foo','https://user:pass@youtube.com/watch?v=abcdefghijk'])assert.throws(()=>youtubeVideo(s));});
