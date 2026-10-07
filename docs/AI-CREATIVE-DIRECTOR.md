# Local AI creative director

User-selected goal: creative product advertisements from product facts and reference photos. No talking human generation, third-party paid model API, Docker or execution of generated code.

Flow: save product draft -> enter verified facts, audience and CTA -> request local AI plan -> Windows worker calls local Ollama -> inspect generated hook, copy, scene layout and motion -> apply to unsaved editor -> review and save -> render MP4.

The model only sees the written brief, not the uploaded image. It must not invent prices, discounts, claims or certifications. The result is a reviewed draft, not a claim-verification system. Uploaded image stays in the media workflow.

Add an owner-scoped, draft-linked plan queue with private RLS, single active request per owner, bounded retries, claim tokens and leases. Deleting the draft/account cascades queue cleanup. Model failure is explicit and never falls back to a preset labelled AI.

Use constrained structured JSON. Validate scene count, text lengths, duration, layout, motion and palette on the server before showing/applying. Keep input and output out of analytics/logs. User edits are never overwritten by background completion.

Renderer layouts: legacy full frame, opening hero, benefit panel, product spotlight, CTA. These have different actual image placement, panel geometry and editable display text. Preview uses corresponding geometry and fonts; export remains authoritative. Keep existing legacy drafts compatible.

Verification: local model inference on Indonesian product facts; invalid output and prompt injection boundaries; cross-owner access, lease/retry and deletion checks; UI apply/save/restore; rendered frame and audio checks. A local model installation alone is not successful feature verification.

## October 7 planner reliability update

The local planner now requests four named scene slots (hero, benefit, spotlight, CTA). Native code assigns their order and reading-time durations; the model writes the concept and scene copy and chooses palette, motion and transitions. This prevents repeated arrays that omit the ending. Evidence values are constrained to substrings of the submitted facts. This is a provenance aid, not semantic claim verification; review is still mandatory.

Qwen3 4B runs CPU-only, with a bounded response budget and an eight-minute request timeout. Unconstrained fast trials produced repetitive or unsupported copy; a long reasoning-mode trial also failed validation. The final prompt uses named slots, constrained evidence and a short copywriting example with reasoning disabled. No preset fallback is presented as AI. A failed request can be retried from the same draft.

The worker logs operation state and elapsed time without logging brief content. Caption groups now use the same five-word setting as the preview.

Live verification (October 7): the final local-model request completed through the production plan queue in 38 seconds. Its copy still included an unsupported "cepat" in one display heading; the reviewer changed that heading to "Untuk jenggot dan kumis" before rendering. This is evidence of the need for review, not proof of factual reliability. The reviewed plan rendered through the production job queue and private R2 storage, and downloaded as a 30-second 1080x1920 H.264/AAC MP4. Four distinct compositions and captions were visually inspected; audio mean -24.1 dB, peak -9.9 dB. The temporary draft, plan, project and stored output were deleted afterward; the original user draft was not changed. Local verification artifacts remain under ignored work/creative-test.

Validation: 35 Node tests passed, plus one Python planner contract test. The latter checks loopback-only model requests, CPU configuration, constrained evidence values, scene order and reading-time calculation. This is a tested first iteration of a creative assistant, not a guarantee of professional copy or presenter generation.
