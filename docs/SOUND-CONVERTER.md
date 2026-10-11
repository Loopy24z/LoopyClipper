# Sound converter

Open `/audio` after signing in. Accessible from the desktop rail and mobile workspace navigation.

## Source and behavior

Adapted from https://github.com/Loopy24z/sound-convert. Encoder provenance is in `public/audio/SOURCE.txt`; its libvorbis bundle is unchanged. No external audio service or credit charge is involved.

- MP3 CBR: 64, 96, 128, 160, 192, 256 or 320 kbps.
- OGG Vorbis: approximate stereo bitrate targets mapped to quality settings (variable bitrate).
- WAV: PCM 16-bit / 44.1 kHz, up to stereo. Bitrate follows channel count.
- Default speed 2.3x, gain -4 dB, source limit 350 seconds.
- Source is trimmed from the beginning before speed is applied. Speed also changes pitch.
- Roblox PlaybackSpeed displays the reciprocal of the conversion speed.
- Up to 10 inputs per batch, 25 MB per file. Decoding depends on browser codec support.
- Encoding runs in a Web Worker. Cancel stops the encoder; already completed outputs remain.
- Positive gain is clipped safely and a warning appears when peaks exceed full scale.
- The encoder pulls bounded source blocks (at most about 512 KiB at 4x stereo). It does not copy the entire source or allocate a full PCM output. Browser decoding still holds one decoded source; long compressed files can require substantial memory. WAV output remains larger than MP3/OGG.

## Local history

IndexedDB stores actual audio blobs, filtered by signed-in account ID. The browser-wide limit is 20 outputs / 100 MB; oldest outputs are evicted. This is local convenience storage, not cloud backup or protection from someone with access to the browser profile. Download important files. Clearing browser data removes history.

## Validation

Real Chrome conversion: 12-second WAV, source limit 10 seconds, speed 2x produced a playable 5-second stereo Vorbis OGG verified by ffprobe. Browser checks cover reloadable history, deletion, invalid/valid batch isolation and responsive layouts at 320, 375, 768, 1024 and 1440 px. Clipper, editor and UGC layouts were checked at the same widths with fixture APIs. These checks do not replace testing on physical iOS/Android devices.

## Link imports

Direct HTTPS audio-file URLs download into the browser with a 25 MB streaming cap and 90-second timeout. The remote host must permit CORS. No server proxy is used for arbitrary URLs.

Social links (YouTube, TikTok, Instagram, Facebook, X and SoundCloud) are admitted through an explicit host allowlist. The native Windows processor uses only the corresponding yt-dlp extractors, no generic extractor, login cookies, or playlists. A single public source must be at most 20 minutes and 100 MB. Platform restrictions can still block a download. The import bridge is MP3 128 kbps; increasing output bitrate later cannot restore lost quality. Local-file conversion avoids this bridge.

Each account can queue one import at a time, with 10 requests per rolling 24 hours. Sources/results are owner protected. Temporary objects expire after 24 hours; the worker removes expired objects on its next poll, so physical cleanup can be delayed while the worker is offline. Cancellation invalidates the job lease. Object reservations are retained until cleanup to account for interrupted or late uploads. The database storage quota caps aggregate reservations.

Apply `0006_audio_imports.sql` and restart the local processor after deploying. Browser conversion continues to work when the processor is offline; social imports wait in the queue.

MP3 encoder: unmodified lamejs (LGPL-3.0). License and corresponding source/build scripts are shipped under `/audio/LAME-LICENSE.txt` and `/audio/lame-source.zip`. Provenance is in `/audio/SOURCE.txt`.

Additional verification: real MP3 output inspected by ffprobe at 192000 bps and WAV output at 1411200 bps. Integration tests cover ownership, idempotency, cancelled leases and size bounds. External platform success must be checked with an authorized public URL; no guarantee is made for private, restricted, or login-only content.

Long-audio regression: a 350-second stereo MP3 (~5.6 MB) converted at 1x to MP3, OGG and WAV in Chrome. The previous 128 MiB estimate incorrectly rejected this case by counting a full PCM output. The worker now pulls bounded blocks; a regression test verifies WAV duration and channel samples across block boundaries.
