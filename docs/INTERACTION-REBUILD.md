# Interaction rebuild — 2026-09-20

Implemented against local branch `codex/four-page-studio`, base `a7a0a2c`.
Source of requirements: user-provided pasted interaction audit. The two named
Downloads attachments were not present at their supplied paths; this document
does not claim they were read.

## Modules and tuning

- `src/features/particles/interaction.ts`: raw position, segment sweep, bounded
  directional impulse. `field.ts` applies force at each particle's current position.
  No extra pointer-position smoothing. Renderer/colors are unchanged.
- `src/features/cloth/solver.ts`: original CPU XPBD implementation. Fixed 120 Hz
  steps, stretch/shear/two-hop bending distance constraints, two fixed supports,
  gravity, wind, weighted patch grabbing and release velocity. Floor/rear collision
  bounds plus spatially hashed particle-thickness self/inter-sheet contacts. This
  is discrete collision, not continuous triangle contact: extreme folds can still
  intersect between mesh vertices. No third-party simulation code was copied.
- `src/features/cloth/config.ts`: separate soft fabric and stiff paper presets.
  `controller.ts` owns rendering, raycasts, capture, observers and disposal for both
  installations. Touch scrolling is preserved; fabric grabbing currently uses mouse/pen.
- `ThreadCoveCase.astro`: three simulated surfaces with stable HTML stage controls.
- `tidal.ts`: OrbitControls for full yaw drag, bounded pitch, time-adjusted damping;
  hover pauses after a drag until reset. RoomEnvironment/PMREM lighting, colored
  glazed entities. No zoom/pan; explicit touch viewing toggle.
- `intro/config.ts`: scrub directly follows scroll, contact .58–.78, disappearance
  .78–.92, arrival .92–1. `animation.ts` reports decoded assets and trigger bounds.

## Validation

- `node scripts/particle-input-test.mjs`: sweep locality, reversal, stationary input,
  impulse bound.
- `node scripts/cloth-physics-test.mjs`: fixed supports, finite solver values,
  grabbed displacement, continued motion after release, variable frame steps, reset.
- `node scripts/interaction-browser.mjs`: actual pointer/wheel events, full ceramic
  drag/retention/reset, fabric grabs, contact/hold/fade/completion/reverse and video.
- `node scripts/studio-browser.mjs`: four routes at desktop/mobile viewport widths,
  motion preferences, keyboard tabs, image loading, no-JS content and cleanup.
- Browser tests serve the current `dist/` on a fresh ephemeral localhost port.
  They cannot silently attach to a stale dev server.
- Artifacts remain local under `review-output/interaction-rebuild/`.
- These are Chromium software-GPU/viewport tests, not physical mobile performance.
- AGY validation was attempted but blocked by headless command permission and then
  by `FAILED_PRECONDITION: User location is not supported for the API use`.
  Primary agent performed the local validation under the user's direct-work request.

No deployment or GitHub merge is part of this rebuild.
