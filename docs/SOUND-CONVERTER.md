# Sound converter

Open `/audio` after signing in. Accessible from the desktop rail and mobile workspace navigation.

## Source and behavior

Adapted from https://github.com/Loopy24z/sound-convert. Encoder provenance is in `public/audio/SOURCE.txt`; its libvorbis bundle is unchanged. No external audio service or credit charge is involved.

- OGG Vorbis output, quality 0.4, up to two channels.
- Default speed 2.3x, gain -4 dB, source limit 350 seconds.
- Source is trimmed from the beginning before speed is applied. Speed also changes pitch.
- Roblox PlaybackSpeed displays the reciprocal of the conversion speed.
- Up to 10 inputs per batch, 25 MB per file. Decoding depends on browser codec support.
- Encoding runs in a Web Worker. Cancel stops the encoder; already completed outputs remain.
- Positive gain is clipped safely and a warning appears when peaks exceed full scale.
- The decoded selection and estimated output have a 128 MiB processing budget. Very long compressed files can still require substantial memory during browser decoding.

## Local history

IndexedDB stores actual audio blobs, filtered by signed-in account ID. The browser-wide limit is 20 outputs / 100 MB; oldest outputs are evicted. This is local convenience storage, not cloud backup or protection from someone with access to the browser profile. Download important files. Clearing browser data removes history.

## Validation

Real Chrome conversion: 12-second WAV, source limit 10 seconds, speed 2x produced a playable 5-second stereo Vorbis OGG verified by ffprobe. Browser checks cover reloadable history, deletion, invalid/valid batch isolation and responsive layouts at 320, 375, 768, 1024 and 1440 px. Clipper, editor and UGC layouts were checked at the same widths with fixture APIs. These checks do not replace testing on physical iOS/Android devices.
