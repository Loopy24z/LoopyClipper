# Source-grounded hook picker

Clip options offers up to five original spoken excerpts lasting 1-3 seconds. Candidates start at sentence/pause boundaries inside retained segments, score question/surprise/curiosity/mistake/benefit cues and exclude greetings or dependent openings. Every quoted word finishes within the preview window; following speech continues in order after applying. These are lexical cues, not semantic validation or predicted engagement.

Preview seeks to the source excerpt and stops at its output-time boundary. Start clip here trims earlier material and preserves later pause cuts. Undo restores previous start/segments. Applying does not enable a headline. Optional on-screen quote explicitly enables the existing editable three-second headline, limited to 80 characters without silent truncation in the picker.

Automatic suggestions share the expanded opening score. Existing reviewed clips are unchanged until the user chooses a hook. Review context after moving the start; source quotations can still depend on earlier explanation.

Verification: 42 Node tests passed, production build passed, actual React editor with mocked API tested preview stop, apply/segments, undo, optional quote, autosave/reopen. Existing export pipeline renders the saved start and segments; no new render format is introduced.

## Context review and motion (render protocol 9)

The picker now exposes angle filters and the following original speech (up to 12 seconds from the opening), including a separate continuation preview. It rejects dangling endings and openings without at least four following words. Concrete amounts/time/cost cues improve ranking, but selection remains transcript-rule based, not a semantic AI assessment or prediction of human behavior.

Motion Studio offers Hook focus (opening zoom settles in 3 seconds), Slow drift (8-second cycle), and Editorial rhythm (4-second framing changes). Strength is bounded to 4-16%. Captions are composited after motion so text stays readable. Preview and FFmpeg use output time after pause cuts. Settings autosave and can be stored in templates. Existing clips default to Original/no motion. Apply kinetic caption look is explicit and replaces caption styling only.

This is native source-video motion, not a general scene-graph motion-graphics editor or automatic B-roll generator. Always check cropping around faces. There is no automatic subject tracking.
