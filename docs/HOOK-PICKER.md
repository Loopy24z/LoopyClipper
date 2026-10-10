# Source-grounded hook picker

Clip options offers up to three original spoken excerpts lasting 1-3 seconds. Candidates start at sentence/pause boundaries inside retained segments, score question/surprise/curiosity/mistake/benefit cues and exclude greetings or dependent openings. Every quoted word finishes within the preview window; following speech continues in order after applying. These are lexical cues, not semantic validation or predicted engagement.

Preview seeks to the source excerpt and stops at its output-time boundary. Start clip here trims earlier material and preserves later pause cuts. Undo restores previous start/segments. Applying does not enable a headline. Optional on-screen quote explicitly enables the existing editable three-second headline, limited to 80 characters without silent truncation in the picker.

Automatic suggestions share the expanded opening score. Existing reviewed clips are unchanged until the user chooses a hook. Review context after moving the start; source quotations can still depend on earlier explanation.

Verification: 42 Node tests passed, production build passed, actual React editor with mocked API tested preview stop, apply/segments, undo, optional quote, autosave/reopen. Existing export pipeline renders the saved start and segments; no new render format is introduced.
