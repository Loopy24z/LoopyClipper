# Presenter ads - integration status

The Presenter ad mode saves two JPEG reference previews, permission flags, video direction, voice character, verified product facts and CTA in the existing owner-scoped UGC draft. `lib/ugc-presenter.mjs` builds a deterministic production prompt; it does not call a language model or render video.

Generation is intentionally unavailable. The current worker can animate a product image but cannot synthesize a speaking presenter, hand/product interaction or a voice from a photograph. `ugcRender` continues to reject presenter drafts. No provider calls, credit charges or public uploads are introduced.

Before enabling Generate, connect a model with reference-image identity and product consistency, authorized adult likeness support, a licensed voice catalogue and lip-sync or synchronized speech. Persist original references privately for that model instead of relying on the 640px draft previews. Implement owner-scoped jobs, capability and health checks, bounded retries, cost estimates and explicit confirmation before paid generation. Report actual provider errors and preserve drafts on failure. Test real output for identity, hands, packaging consistency, voice timing and playable MP4 before marking the feature available.

Voice character is a requested delivery style, not an inferred or cloned identity. Premium studio styling never authorizes fabricated product benefits, testimonials, discounts or endorsements.
