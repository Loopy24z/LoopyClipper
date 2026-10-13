import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'processor'))
from ugc_timing import voice_timeline


class VoiceTiming(unittest.TestCase):
    def test_preserves_recorded_timing_and_pauses(self):
        words = [{'text':'Hello','start':.4,'end':.9}, {'text':'product','start':1,'end':1.5}, {'text':'Buy','start':3,'end':3.4}, {'text':'now','start':3.5,'end':4}]
        scenes, groups = voice_timeline([{'narration':'Hello product','seconds':10}, {'narration':'Buy now','seconds':10}], words, 4.7)
        self.assertAlmostEqual(scenes[0]['seconds'], 2.25)
        self.assertAlmostEqual(sum(s['seconds'] for s in scenes), 4.7)
        self.assertEqual([w for group in groups for w in group], words)

    def test_short_recording_has_no_empty_or_zero_duration_scenes(self):
        scenes, groups = voice_timeline([{'narration':'a'}]*8, [{'text':'hello','start':0,'end':.5}], 1)
        self.assertEqual(len(scenes), 1)
        self.assertEqual(scenes[0]['seconds'], 1)
        self.assertEqual(len(groups[0]), 1)

    def test_invalid_or_silent_recording_is_actionable(self):
        for duration in [0, 61, float('nan')]:
            with self.assertRaisesRegex(ValueError, '60 seconds'):
                voice_timeline([{}], [], duration)
        with self.assertRaisesRegex(ValueError, 'No speech'):
            voice_timeline([{}], [], 5)

    def test_clamps_overlap_without_cutting_off_last_word(self):
        words = [{'text':'a','start':-.2,'end':1}, {'text':'b','start':.8,'end':2.5}]
        _, groups = voice_timeline([{'narration':'a b'}], words, 2)
        self.assertEqual(groups[0], [{'text':'a','start':0,'end':1}, {'text':'b','start':1,'end':2}])


if __name__ == '__main__':
    unittest.main()
