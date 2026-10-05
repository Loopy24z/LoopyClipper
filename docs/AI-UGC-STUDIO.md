# AI UGC Studio — integration brief

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
