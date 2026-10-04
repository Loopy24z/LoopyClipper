# Loofy Clip: pacing, captions, and credit experience

Status: proposed for owner review; not implemented or deployed.

## Intent and observed baseline

The creator wants useful short clips with coherent beginnings and endings, less dead air, more caption styles, and clear credit/subscription controls. Keep the web application, English UI, English/Indonesian content, Supabase, private R2, Vercel web hosting, and separate Python/FFmpeg processor. Interpret “staking” as improvements to the application stack; no financial staking feature.

Code inspection on 2026-10-04 confirms:
- `lib/domain.mjs` selects fixed roughly 30-second windows using question/advice keywords. This is not semantic highlight selection.
- `ClipData` and FFmpeg support one start/end interval. VAD is enabled during transcription, but the rendered video still contains pauses.
- Captions have three generic font families, four effects, and six-word grouping. A caption override currently stays across the whole clip.
- Daily credits, project charging/refunds, admin grants and manually activated plans exist. There is no payment checkout or automatic renewal.

The previous vertical framing change is preserved: new clips fill 9:16 by cropping; users can move the crop or select fit.

## Alternatives and recommendation

1. Recommended: extend the existing pipeline with an explicit edit decision list, shared caption layouts, and improved transcript-based draft selection. Retains current infrastructure and avoids a new paid AI dependency.
2. Add an external language model for semantic ranking. Potentially better topic/context selection, but introduces provider configuration, cost and transcript transfer. Defer until local editing is reliable and a provider is selected.
3. Replace the editor and renderer. Higher migration cost and regression risk with no immediate advantage for silence removal. Do not pursue in this increment.

Local scoring must be labeled transcript-based suggestions, never a proven virality or semantic-understanding score. Every suggestion remains editable and requires review.

## Delivery boundaries

First deliverable: caption choices, coherent draft boundaries, reversible silence removal, and matching preview/export. Credit usage stays compatible.

Second independent deliverable: improve the existing credit and plan screens and implement the selected payment mode. Payment selection does not block editing design. Payment-provider integration requires its own reviewed design once the owner chooses manual activation or automatic payment; do not substitute a fake checkout.

## Edit decision list

Add a versioned `edit` object to clip JSON: `{ version: 1, mode: 'off'|'natural'|'balanced'|'tight'|'custom', segments: [{ start, end }] }`. Times are absolute source seconds in chronological order. Existing `start`/`end` remain the outer trim range. Missing `edit` means one continuous interval and preserves old clips and queued exports.

Validate on the server and worker: finite numbers, nonempty list, each segment at least 0.1 seconds, sorted, disjoint, within both source duration and outer trim. Cap at 200 segments. Output duration is the sum of segment lengths; never use outer range duration for the output timeline or progress. Reject invalid lists instead of silently repairing user edits.

Changing outer trim intersects the existing segments with that range. Moving to a wholly different range resets to a continuous interval and offers reanalysis. Transcript text edits do not change timing. Reanalyzing pauses is explicit and does not overwrite custom cuts without confirmation.

Maintain a pure source-to-output and output-to-source mapping plus golden JSON fixtures consumed by TypeScript and Python tests. Store final segments, caption settings and transcript snapshot in each export job. Later edits do not change an already queued export.

## Pacing and pause removal

Controls: Keep pauses, Natural, Balanced, Tight; show original duration, edited duration, seconds removed and cut count. Balanced is the proposed default for newly generated suggestions; old clips retain their current timing until the creator applies it.

Candidate pauses must be between recognized words, corroborated by speech activity detection. Missing transcription is not evidence of silence. Persist original-time speech intervals with the transcript when processing new videos. Existing projects may request analysis as a background job; keep them playable while analysis runs. If no reliable speech metadata is available, show that pause analysis is unavailable and preserve the audio/video.

Initial thresholds to calibrate with fixtures:

| Mode | Minimum gap | Retained speech-edge padding per side |
|---|---:|---:|
| Natural | 0.90 s | 0.20 s |
| Balanced | 0.65 s | 0.16 s |
| Tight | 0.45 s | 0.12 s |

Retain extra 0.15 seconds after sentence-ending punctuation when the gap permits. Require at least 0.15 seconds of removable silence after padding. Do not cut inside word timestamps or any detected speech interval. Merge cuts that would leave an isolated segment shorter than 0.8 seconds. Do not reorder speech, delete filler words automatically, or speed up speech. Never process solely from audio amplitude, which can confuse quiet speech with silence.

List proposed removed gaps with adjacent transcript text; allow restore/remove and reset to original. Show cut marks on the output timeline. Auto-cut suggestions remain drafts, and “professional” quality requires human review, not a marketing guarantee.

## Highlight selection

Build sentence/utterance boundaries from punctuation and longer speech gaps; assemble chronological candidates targeting 15–90 seconds of output. Prefer complete opening and closing sentences, sufficient speech content, and a question/advice/example with supporting context. Penalize clipped sentence boundaries, near-duplicate text and excessive pauses. Use transparent reasons drawn from measurable evidence, not invented topic summaries.

Rank candidates, reject candidates overlapping more than 20 percent of the shorter candidate, and return at most five. Do not force five if only fewer coherent candidates exist. Preserve reviewed clips on refresh. Manual clipping remains available for short, silent or poorly transcribed sources.

Titles and descriptions remain editable extracts unless a future semantic provider is explicitly configured. Show source range, final duration, cut count and selection reason on each card.

## Caption experience

Offer six selectable visual presets: Clean, Bold outline, Background box, Drop shadow, Active word highlight, and Single word. Selecting a preset initializes editable settings; later manual changes are stored as Custom.

Provide five bundled, licensed font families with matching browser and worker font files: Noto Sans, Noto Serif, Noto Sans Mono, Montserrat and Oswald. Verify licenses and include notices when adding assets. Keep legacy font IDs supported for existing projects.

Controls: font, weight, size, text/highlight/background colors, stroke width, shadow, top/center/bottom placement, safe-area offset, and 1–6 words per phrase. Support editable individual caption cues with reset-to-transcript. Legacy full-clip caption overrides retain their existing behavior until reset.

Construct a canonical caption layout with output-time cue and word intervals after segment mapping. Split cues at cuts and never show a removed word. Explicit line breaks and the same font assets drive DOM preview and ASS/libass burn-in. Active-word highlighting uses word timestamps; keep text width fixed while changing its color. Presets must not advertise unsupported animated effects.

Use a consistent 1080-based layout model and scale it for each aspect ratio. Keep text within frame safe margins. Escaping must prevent subtitle text from injecting ASS tags or FFmpeg filter options.

## Preview and export

Immediate draft preview follows the edit list, seeks across removed ranges, uses an output-time scrubber, and handles play/pause/end correctly. Seeking must not play audio from a removed interval. Browser seeking can buffer; expose an explicit rendered-preview action for checking exact cut timing using the same render pipeline. Reuse a matching completed render as the export rather than charging or rendering again.

FFmpeg trims corresponding video/audio ranges, resets timestamps and concatenates them before framing and caption burn-in. Keep audio and video durations aligned; use tiny audio edge fades only within retained padding to avoid clicks without cutting speech. Video-only sources work. Preserve H.264/yuv420p, AAC where audio exists, faststart, and existing ratios.

Show worker availability and stages (waiting, analyzing pauses, rendering, uploading, ready/failed). Keep leases/heartbeats, owned-media access and immutable job snapshots. New multi-segment jobs must not be consumed by an incompatible worker: add a job/worker capability gate and deploy the compatible worker before enabling creation of new-format jobs. Failed analysis/render preserves edits and supports retry.

## Credit and subscription brief

Use one app currency named credits. Keep the existing rule: one credit per started source minute; editing, local highlight refresh, pause analysis and export do not add charges. Retain daily reset at 00:00 WIB, the current allowance of 10 unless changed by admin, and verified UUID-based unlimited admins. Unlimited credits never bypass file/storage limits.

Display balance split into daily and purchased, reset countdown, expiry, history, and a pre-processing estimate. For YouTube, explain that the exact amount follows duration discovery. Preserve transactional debit/refund and idempotent retries. Avoid adding a second AI-token balance.

Manual option: improve plan cards, request state, cancellation of pending requests, and admin activation audit. Snapshot plan amount, credits and validity at request time, so later plan edits cannot alter a pending purchase. Label fixed-duration access clearly: no automatic renewal.

Automatic option: select a provider and implement sandbox checkout and verified, idempotent server-side payment events before enabling real purchases. Never grant credits from a browser success redirect. Pricing, currency, provider, renewal/refund behavior and commercial hosting requirements must be resolved in that billing design; no invented prices or paid service activation in this editing increment.

## Verification and rollout

- Unit tests: silence thresholds, padding, missing VAD, quiet speech, sentence endings, overlap validation, mapping round trips and legacy single-range compatibility.
- Caption tests: EN/ID punctuation, cue editing, cut-boundary remapping, escaping, no word from removed intervals, preset/font validation.
- Real FFmpeg fixtures: source with three speech/tone blocks separated by known silence; confirm output duration, retained audio blocks, chronological cuts and captions across all three ratios. Output duration within 100 ms of the edit list; caption mapping within 100 ms of supplied timestamps. This does not prove speech recognition accuracy.
- Browser verification: seek near cuts, pause/resume, switch clips, autosave/reopen, restore pause, caption presets, portrait fill and matching rendered preview. Listen to real EN/ID examples for natural pacing before calling the default release-ready.
- API tests: owner isolation, immutable export payloads, capability mismatch, no duplicate active jobs, retries and credit refund behavior. Billing changes additionally require concurrent activation and plan-snapshot tests.
- Preserve existing media and reviewed edits; do not mass-regenerate user projects. Release behind a capability flag, then offer explicit Analyze pauses / Refresh suggestions on existing projects.
- CPU processing still needs a running worker. Do not claim the web host alone makes rendering available continuously. Verify worker heartbeat and complete an authenticated cloud export before marking the end-to-end release finished.

## Self-review

The editing change is independently deliverable; external billing and semantic AI are explicit follow-ups. Compatibility, missing-analysis behavior, time mapping, worker deployment ordering, and measurable export checks are defined. The owner still needs to review this written proposal before the implementation plan under the active brainstorming workflow.
