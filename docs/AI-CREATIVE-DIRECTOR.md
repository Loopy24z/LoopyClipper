# Local AI creative director

User-selected goal: creative product advertisements from product facts and reference photos. No talking human generation, third-party paid model API, Docker or execution of generated code.

Flow: save product draft -> enter verified facts, audience and CTA -> request local AI plan -> Windows worker calls local Ollama -> inspect generated hook, copy, scene layout and motion -> apply to unsaved editor -> review and save -> render MP4.

The model only sees the written brief, not the uploaded image. It must not invent prices, discounts, claims or certifications. The result is a reviewed draft, not a claim-verification system. Uploaded image stays in the media workflow.

Add an owner-scoped, draft-linked plan queue with private RLS, single active request per owner, bounded retries, claim tokens and leases. Deleting the draft/account cascades queue cleanup. Model failure is explicit and never falls back to a preset labelled AI.

Use constrained structured JSON. Validate scene count, text lengths, duration, layout, motion and palette on the server before showing/applying. Keep input and output out of analytics/logs. User edits are never overwritten by background completion.

Renderer layouts: legacy full frame, opening hero, benefit panel, product spotlight, CTA. These have different actual image placement, panel geometry and editable display text. Preview uses corresponding geometry and fonts; export remains authoritative. Keep existing legacy drafts compatible.

Verification: local model inference on Indonesian product facts; invalid output and prompt injection boundaries; cross-owner access, lease/retry and deletion checks; UI apply/save/restore; rendered frame and audio checks. A local model installation alone is not successful feature verification.
