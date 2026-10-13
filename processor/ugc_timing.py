"""Speech-driven captions and scene boundaries for the local product renderer."""
import math


def voice_timeline(scenes, words, duration):
    if not math.isfinite(duration) or not 0 < duration <= 60:
        raise ValueError('Use a voice recording between 1 and 60 seconds.')
    clean = []
    for word in words:
        start, end = float(word['start']), float(word['end'])
        text = str(word['text']).strip()
        if not text or not math.isfinite(start) or not math.isfinite(end):
            continue
        start = max(0, start, clean[-1]['end'] if clean else 0)
        end = min(duration, end)
        if end > start:
            clean.append({'text': text, 'start': start, 'end': end})
    if not clean:
        raise ValueError('No speech was detected. Upload a clear voice recording or remove voiceover to use music only.')
    # Assign visual beats in narration order, with cuts between recognized words.
    # This is pacing, not forced alignment of the typed script to a different recording.
    selected = scenes[:min(len(scenes), len(clean))]
    weights = [max(1, len(s.get('narration', '').split())) for s in selected]
    result, groups = [], []
    cursor, elapsed, weight = 0, 0.0, 0
    for index, scene in enumerate(selected):
        weight += weights[index]
        last = index == len(selected) - 1
        stop = len(clean) if last else max(cursor + 1, min(len(clean) - (len(selected) - index - 1), round(len(clean) * weight / sum(weights))))
        boundary = duration if last else (clean[stop-1]['end'] + clean[stop]['start']) / 2
        result.append({**scene, 'seconds': boundary - elapsed})
        groups.append(clean[cursor:stop])
        cursor, elapsed = stop, boundary
    return result, groups


def transcribe_voice(path, language):
    import worker
    if worker.MODEL is None:
        import os
        from faster_whisper import WhisperModel
        worker.MODEL = WhisperModel(os.getenv('WHISPER_MODEL', 'base'), device=os.getenv('WHISPER_DEVICE', 'cpu'), compute_type=os.getenv('WHISPER_COMPUTE', 'int8'), download_root=os.getenv('WHISPER_CACHE'))
    segments, _ = worker.MODEL.transcribe(str(path), language=language if language in ('id', 'en') else None, word_timestamps=True, vad_filter=True, beam_size=5)
    return [{'text': word.word, 'start': word.start, 'end': word.end} for segment in segments for word in (segment.words or [])]
