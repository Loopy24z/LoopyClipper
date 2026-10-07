# AI UGC Studio â€” integration brief

Status: draft workspace implemented; AI generation has not been run or enabled.

The owner selected AI UGC from images and a script, rather than an editor limited to existing footage. Add a separate AI UGC workspace to the current web application. Keep the clipping editor for finishing generated videos.

## Creator flow

1. Choose Product video or Presenter video.
2. Upload a reference image and confirm permission to use the image/person.
3. Enter the spoken script, source language (Indonesian/English), product description and optional call to action. Do not invent product claims or personal testimonials.
4. Choose a supported duration and 9:16 format. Show the selected model, available audio support, estimated provider cost, and exactly which image/script will be submitted before generation.
5. Explicit Generate action starts one asynchronous request. Show queued, generating, saving, ready or actionable failure state. Reopening the page restores the request.
6. Copy the completed output into private R2 storage. Let the owner preview/download and open it in the clipping workflow for transcription, caption styling, optional headline and export.

Exact spoken wording, lip synchronization and product consistency are model capabilities to test, not guarantees. A product image-to-video model alone must not be presented as an accurate speaking-avatar pipeline. Long ads need multiple reviewed scenes; begin with one short scene supported by the selected model.

## Integration boundaries

- Higgsfield supplies generative models through an asynchronous API. Remotion is optional for later motion graphics/composition, not a replacement for a generative model. Do not add a new renderer dependency solely to create AI footage.
- Server-only credentials: `HF_API_KEY_ID`, `HF_API_KEY_SECRET`. Neither was configured in the local project when checked. Store credentials in ignored `.env.local`, then deployment secrets; never in browser code or chat.
- Verify the model-specific endpoint and request schema in the account's official console. Console access could not be verified during research. Do not guess image, audio or lip-sync parameters from text-to-video examples.
- Use owner-scoped UGC draft/job records, private input storage, expiring input URLs, immutable submission snapshots and request IDs. Provider input access is an intentional disclosure shown in the Generate UI.
- Integrate input and result byte reservations with existing account/global storage quotas; use direct signed uploads to avoid routing image/video bodies through the web host.
- A timed-out submission has an unknown outcome: reconcile using the provider request identifier when available, rather than automatically submitting another potentially billable request.
- Verify webhook authenticity using the provider's documented mechanism or poll via authenticated server requests. Do not accept a client-supplied completion URL as trusted output. Restrict downloads to verified provider output locations with bounded sizes/timeouts and safe redirects.
- Copy successful output to owned storage before treating it as durable. Use the existing processor to normalize browser compatibility and produce the transcript before opening the clip editor.
- Deleting a workspace must remove UGC drafts/input/output media and cancel eligible provider jobs, while preserving required billing records. Discard late results from deleted jobs.

## Cost and activation

Existing daily clipping credits cover source processing; they do not establish payment authorization or balance at Higgsfield. Define an explicit AI-generation allowance and provider-cost estimate after selecting a model. Keep generation disabled until credentials, model access, cost policy and a first limited test are ready. Do not silently purchase subscriptions or credits.

The owner requested the separate workspace first. Provider activation remains pending API access, model verification and cost configuration. Existing clipping/caption/template behavior remains available.

## Acceptance checks

- Owner A cannot fetch, submit, cancel, download or delete owner B's UGC drafts/jobs.
- Validation rejects unsupported images, excessive sizes/scripts and unsupported model parameters before charging.
- Double-click, refresh, retry and webhook replay do not duplicate a paid generation or grant/refund.
- Missing credentials and insufficient provider balance have explicit setup/error states, not simulated progress or fake videos.
- One real authorized fixture produces playable stored video and opens in the clip editor; test Indonesian and English spoken output separately before advertising both.
- Real generation checks must record actual model, duration, cost, audio availability and limitations.

## Official references reviewed

- https://higgsfield.ai/higgsfield-api
- https://docs.higgsfield.ai/docs
- https://docs.higgsfield.ai/docs/llms.txt
- https://www.remotion.dev/docs/license/pricing

Shared API documentation confirms asynchronous submission/status handling. Model access and billing are not verified for this account. The implementation status is recorded below; provider integration remains a proposal.

## Implemented workspace - 2026-10-05

The authenticated /ugc workspace is implemented with a dedicated responsive purple studio UI, Product story / AI presenter briefs, JPEG/PNG reference resizing (maximum 640 px), an editable script and starter outline, creative direction, target duration and frame preferences. Drafts support save, reopen, update and delete, with a maximum of 20 per account. Small reference thumbnails are stored in private draft metadata; original image uploads and video generation are not implemented.

Migration 0003_ugc_drafts enables RLS and restricts database access. Server routes scope every operation to the verified owner; account deletion removes these drafts. Generation is disabled explicitly, with no provider requests or generation credit charges. Model selection, original image storage, cost estimates, generation jobs, generated playback and transfer to Clipper remain pending provider setup.

Validation: production build; API integration tests for draft CRUD, limits and cross-owner isolation; domain input tests; actual React component in isolated Chrome harness with mocked API for save/reopen/delete and responsive layout. This harness is not a live authenticated end-to-end generation test.

### Draft workflow improvements
The studio supports campaign/subject search, product/presenter filtering, duplication into an unsaved draft, plain-text brief download and script copying. Reading time is an estimate at 150 words/minute, including stage directions. These tools do not invoke generative models. Production entry point: https://loofyai.vercel.app/ugc.

### Storyboard planning
Up to eight scenes can hold visual direction, exact spoken words and durations. A four-scene outline provides Hook / Benefit / Product demo / Call to action. Plans are limited to 60 seconds total; the studio warns when planned duration differs from the video target. Compiling spoken words into the main script requires confirmation before replacing existing text. Scene notes are saved privately and included in brief downloads. No storyboard video rendering is enabled.

## Local product rendering - 2026-10-06
Product mode now renders the saved JPEG reference with alternating gentle zoom, blurred fit background, per-scene fade transitions and scene-timed captions. Output is 1080p H.264/AAC MP4 in any supported ratio. Optional voiceover/music MP3 inputs total at most 1 MB; voice starts at zero, music is attenuated under voice, tracks are padded or trimmed to the plan. No audio means a silent AAC track. No TTS, generated presenter, or semantic interpretation of visual notes is implemented. The saved 640px reference is upscaled, not restored to original resolution.

Personal use is server-restricted to verified ADMIN_USER_IDS. Render snapshots are immutable; identical submissions reuse the existing job/output. One active UGC job per owner is allowed, 128 MB of source storage is reserved through existing quota triggers, and results are private projects with an editable full-length clip. Retries preserve the render snapshot and completed outputs are reused. Generated projects remain in the project library independently of brief deletion; delete the project to remove its media. Account workspace deletion removes both.

Worker protocol v4 supports these jobs; v3 workers cannot claim them. Start on Windows with `powershell -ExecutionPolicy Bypass -File scripts/start-processor.ps1`. Keep the machine awake. Python environment and FFmpeg are required; Docker and paid AI APIs are not used. `scripts/ugc-render-smoke.py` verifies all three ratios with generated fixtures.

UGC audio is stored in the private job snapshot for retry. Browser audio selections are not saved in draft metadata and must be selected again before a new render; an already-submitted job retains its own audio. Captions are burned in using storyboard timing, not aligned to speech. Future improvements: original-resolution image uploads, per-scene images, editable render captions and voice alignment.

## Native scene editor — 2026-10-06
LoofyAI now has its own React composition preview and FFmpeg export controls, without a Remotion dependency. Preview supports play/pause, seek and scene selection. Each scene supports still/push/pull/alternating zoom and hard cut/fade through black. Captions support outline, box, word highlight or disabled, with top/center/bottom placement. These settings persist with drafts and are validated server-side.
Preview is silent and approximate: exported font wrapping may differ. Caption word timing is distributed over scene duration, not aligned to speech. All scenes currently use the same reference photo; visual direction notes do not create footage. No AI presenter or TTS is included. New jobs require worker protocol 5; existing version-4 jobs remain compatible with the updated worker.
Validation: production build, API/domain regression tests, synthetic 1080p H264/AAC renders in all three aspect ratios, and isolated real-component browser checks for playback/settings/mobile overflow.

## Quick edit and built-in audio — 2026-10-06
Punchy/Calm quick edits preserve all script words (up to 120), create at most eight timed scenes, alternate fit/center-crop framing, select gentle/dynamic movement, caption size and built-in music. Applying over existing scenes asks before replacing settings. Cropping must be reviewed for off-center products.
Pulse and Calm are procedural instrumental WAV loops generated by scripts/create-ugc-music.py with no sampled recordings. Preview plays the selected loop; export loops it to video length, fades the ending and reduces music beneath an uploaded voiceover. Uploaded MP3 music overrides the built-in track. Script text does not synthesize speech. Audio uploads are still per-render and not saved with the draft; built-in music choice is saved. The export panel shows a sound summary and explicit silent warning.
Worker protocol 6 is required for new jobs. Tests: 32 API/domain tests, actual-component browser playback/preset persistence, and 1080p MP4 fixtures in all ratios with decoded PCM RMS verification for non-silent audio.

## Local creative director — 2026-10-07
Implemented owner-scoped AI plan queue and native hero/benefit/spotlight/CTA composition layouts. The Windows worker calls a loopback-only Ollama model; cloud AI is disabled in the local startup script. Qwen3 4B is the selected local planner after the 1.7B trial failed quality checks. Model output is data, never executable code. Schema validation, exact fact-quote evidence, pacing bounds and explicit user review precede applying a plan. Quoted evidence does not prove that every generated claim follows from it: review remains required.

Start `scripts/start-local-ai.ps1` in one terminal, and `scripts/start-processor.ps1` in another. Keep both running while planning/rendering. The portable runtime and downloaded model weights are in ignored `work/ollama`; these are not committed or deployed to Vercel. The planner uses CPU inference and unloads the model after a request to avoid retaining VRAM alongside transcription.

Flow: save a product draft, enter verified positive facts/audience/CTA in AI creative director, create a concept, review evidence and copy, apply to editor, edit individual display copy/layout/palette, save, render. Old full-frame drafts remain supported. New render jobs require worker version 7. Plan queue migration 0004 cascades deletion with draft/account and restricts browser roles. A failed model call preserves the saved draft; retry regenerates the plan. No narrator synthesis, photo understanding or generated product footage is included.
