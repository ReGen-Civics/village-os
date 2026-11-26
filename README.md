# Admin in dark mode, before and after (live-pass QA A2 and A3)

The fix is #1698: `client/src/index.css` no longer sets `--mode-ground` to the night on the dark root, so Admin's light copy of the ground stays light.

These were drawn on a local boot: the built server, a TEST founder, and every module on, for a village with no brand colour set. They are in dark mode at 1280 px (shown at half size) and 390 px. Before is on the left and after on the right.

Measured on all 72 Admin tabs at 390 and 1280 px, light and dark (288 loads):
- **Before:** 117 failing elements on the dark green ground, across 69 tabs.
- **After:** 0.

Other failures in the run are not changed by this fix, and they measure the same in both modes, because Admin draws light in both:
- `gray-400` hint lines, which are A4;
- a few `gray-500`, `red-600`, `gray-300` and `stone-400` lines on grey grounds.

Every screen here shows only TEST data.
