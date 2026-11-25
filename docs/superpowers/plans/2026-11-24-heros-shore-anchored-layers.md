# Hero's Shore Anchored Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Hero's Shore into three compact art groups with repeatable sea-and-sky seams, and have the shader pin the groups to the edges of whatever space the desktop app's panels leave free (heros-shore 0.4.0).

**Architecture:** One plain-JS layout module (`art/layout.mjs`) owns the column ranges, effect anchors, the group-placement math and the panel estimate. The generator imports it to place art. The shader can't import, so it mirrors the constants and the math, and a sync test checks the mirror. The SVG stays a finished static scene; the shader only re-samples it in whole cells.

**Tech Stack:** Node 24 (`node --test`), the repo's `art/pixel.mjs` sprite encoder, Claude Code's `claude-code/shader` language, a TSX hooks module.

**Spec:** `docs/superpowers/specs/2026-11-24-heros-shore-anchored-layers-design.md`

## Global Constraints

- Scene under 131,072 characters, pure vector (no `<image>`, fonts, CDATA; plain comments); `art/gen.mjs` throws past the limit.
- Pixels move only in whole scene cells, at the picture's own scale. No scaling of the scene.
- Every group sits inside columns 24 to 456 (visible at 16:10). Art outside that range is bleed decoration only.
- Group budgets: left 75, center 100, right 75 columns (250 total).
- Shader cost: `claude plugin validate` must report sharpness 2.00 fast and at least 1.48 weak, at 30 fps.
- No scene lookup whose position depends on a buffer read. Layout snaps; no easing.
- sky-realm is untouched; its scene still regenerates byte-for-byte.
- Original art only; no recognizable third-party characters, logos or brands.
- Validate with the app's own Claude Code (`C:\Users\jason\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.326\d31a4581af92\claude.exe`), not the older `claude` on PATH.
- Work on branch `feat/anchored-layers`. Commits follow `feat:` / `fix:` / `docs:` and end with the `Co-Authored-By` line used in this repo.

## Review Focus

1. **Windows narrower than 16:10 (4:3, portrait) with a panel open:** the picture holds fewer columns than 24 to 456; mapping must never ask for a column outside the picture's visible range, and outer edges should be lost cleanly, with no smeared edge columns. (Test in Task 1.)
2. **No prompt box** (`composer` all zeros, or right ≤ left, as while a dialog is up): treat as no panels, not as a giant left panel. (Test in Task 1.)
3. **Free area narrower than the center group** (a right pane over half the window, both panels on a small window): the center stays centered and is clipped symmetrically; no negative widths or NaN. (Test in Task 1.)
4. **Phones, where only the static SVG plays:** the portrait rule's shift must keep the hero and slime inside the center columns. (Test in Task 2.)
5. **A right pane as the only panel:** today it reads as "no sidebar"; after this it must move the right group left of the pane. (Test in Task 1, checked in the app in Task 6.)

---

### Task 1: Layout module and placement math

**Files:**
- Create: `plugins/heros-shore/art/layout.mjs`
- Test: `plugins/heros-shore/art/test/layout.test.mjs`

**Interfaces:**
- Produces:
  - `export const VISIBLE = [24, 456]`
  - `export const LEFT = [24, 99]`, `SEAM_L = [99, 190]`, `CENTER = [190, 290]`, `SEAM_R = [290, 381]`, `RIGHT = [381, 456]` (half-open `[start, end)` scene columns)
  - `export function placeGroups(freeLeft: number, freeRight: number): { oL: number, oC: number, oR: number }` (free edges in scene columns; integer offsets)
  - `export function sourceColumn(x: number, o: { oL, oC, oR }): number` (the scene column to sample for display column `x`)
  - `export function estimatePanels(boxLeftPx: number, boxRightPx: number, windowPx: number): { leftPx: number, rightPx: number }`
  - `export function freeColumns(boxLeftPx, boxRightPx, windowPx, windowHeightPx): { freeLeft: number, freeRight: number }` (applies the Svg's `slice` scale `sC = max(windowPx / 480, windowHeightPx / 270)` and its first visible column `x0 = 240 − windowPx / (2·sC)`)

- [ ] **Step 1: Write the failing tests** (`node:test`, `node:assert/strict`):
  - `identity with no panels`: for windows 1920×1080 and 1440×900 with the box centered, `sourceColumn(x, placeGroups(...freeColumns(...)))` equals `x` for every integer `x` in the picture's visible range.
  - `sidebar keeps the left group whole`: 1440×900, box centered in a free area starting at 300 px: `oL` equals `freeLeft − 24` rounded; columns `[freeLeft, freeLeft + 75)` map into `LEFT`; the center and right groups map whole.
  - `right pane moves the right group`: 1440×900, a right pane of 576 px: `oR < 0`, the last free column maps to column 455, and all three groups map whole.
  - `both panels: center wins`: free width 170 columns: every column of `CENTER` appears once, centered within 1 column of the free area's middle.
  - `seams repeat`: in the sidebar case, the display columns between the left and center groups map into `SEAM_L` with period 91.
  - `narrow window stays in the picture` (Review Focus 1): 1024×768 with a 300 px sidebar: every mapped column lies inside the picture's visible range.
  - `no prompt box` (Review Focus 2): `estimatePanels(0, 0, 1440)` and `estimatePanels(800, 700, 1440)` return `{ leftPx: 0, rightPx: 0 }`.
  - `tiny free area` (Review Focus 3): free width 60 columns: offsets are finite integers and the center is clipped symmetrically within 1 column.
  - `integers only`: every value from `sourceColumn` is an integer.

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test plugins/heros-shore/art/test/`
Expected: FAIL, `layout.mjs` not found.

- [ ] **Step 3: Implement `layout.mjs`.** The placement and source math are decided; use them exactly:

```js
// placeGroups: anchor outer groups to the free edges, center between them or, short of room, in the free middle
oL = max(0, round(freeLeft) - LEFT[0])
oR = min(0, round(freeRight) - RIGHT[1])
lEnd = LEFT[1] + oL; rStart = RIGHT[0] + oR
oC = rStart - lEnd >= CENTER[1] - CENTER[0]
  ? round((lEnd + rStart) / 2 - 240)
  : round((freeLeft + freeRight) / 2 - 240)

// sourceColumn: center has priority, then the outer groups (and their bleed), then wrapped seams
if (x >= CENTER[0] + oC && x < CENTER[1] + oC) return x - oC
if (x < LEFT[1] + oL) return x - oL
if (x >= RIGHT[0] + oR) return x - oR
if (x < CENTER[0] + oC) return SEAM_L[0] + mod(x - (LEFT[1] + oL), SEAM_L[1] - SEAM_L[0])
return SEAM_R[0] + mod(x - (CENTER[1] + oC), SEAM_R[1] - SEAM_R[0])
```

`estimatePanels` before measurement: if `boxRightPx <= boxLeftPx`, no panels; otherwise `shiftPx = (boxLeftPx + boxRightPx) / 2 − windowPx / 2`, all of it on one side (`leftPx = 2·shiftPx` when positive, else `rightPx = −2·shiftPx`). Clamp the result so the outputs stay inside the picture's visible columns (Review Focus 1).

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test plugins/heros-shore/art/test/`
Expected: all pass.

- [ ] **Step 5: Commit** `feat: add the heros-shore layout module and placement math`

### Task 2: Recompose the scene into groups and tileable seams

**Files:**
- Modify: `plugins/heros-shore/art/gen.mjs` (split into an exported `buildScene()` and a CLI entry)
- Modify: `plugins/heros-shore/art/layout.mjs` (add the effect anchors)
- Modify: `plugins/heros-shore/hooks/scene.ts` (regenerated)
- Test: `plugins/heros-shore/art/test/scene.test.mjs`

**Interfaces:**
- Consumes: `VISIBLE`, `LEFT`, `SEAM_L`, `CENTER`, `SEAM_R`, `RIGHT` from Task 1.
- Produces:
  - `export function buildScene(): { svg: string, parts: Array<{ name: string, group: 'left' | 'center' | 'right', box: [x0, y0, x1, y1] }>, seamColumns(seam: 'L' | 'R', width: number): string[] }` from `gen.mjs`. `seamColumns` renders the filler of one seam for `width` columns and returns one string per column (its colors top to bottom), so periodicity can be compared.
  - In `layout.mjs`: `export const EFFECTS = { fire: [x, y], crystal: [x, y], heroBox: [x0, y0, x1, y1], signBox: [x0, y0, x1, y1], seaTop: number, seaBottom: number, sunX: number }`. Every effect anchor and box the shader uses comes from here; the generator places art at these anchors.

- [ ] **Step 1: Write the failing tests**
  - `every part sits in its group`: each `parts[i].box` lies inside its group's range (bleed allowed only for `palm-fronds` and `cliff-bleed`, and only outside `VISIBLE`).
  - `groups cover the listed art`: `parts` includes at least `palm`, `signs`, `crystal`, `computer`, `toys` (left); `hero`, `slime`, `ledge`, `sun`, `moon`, `floating-castle` (center); `cliff`, `fortress`, `campfire`, `guitars`, `amp`, `books` (right); and `mushroom` and `princess-sign` in some group.
  - `seams tile`: for each seam of width `w`, `seamColumns(seam, 2 * w)` has column `i` equal to column `i + w` for all `i < w`.
  - `seams hold only filler`: no part's box overlaps a seam range inside `VISIBLE`.
  - `under the size limit`: `buildScene().svg.length < 131072`.
  - `portrait keeps the hero centered` (Review Focus 4): the portrait shift in the SVG's `@media (max-aspect-ratio: 1/1)` rule keeps `EFFECTS.heroBox` inside `CENTER`.
  - `effect anchors match the art`: `EFFECTS.fire` lies inside the `campfire` part's box, `EFFECTS.crystal` inside `crystal`'s, `EFFECTS.heroBox` contains `hero` and `slime`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test plugins/heros-shore/art/test/`
Expected: FAIL, `buildScene` not exported.

- [ ] **Step 3: Recompose the art in `gen.mjs`.** Keep every existing prop and character; rearrange and resize within the budgets; move the floating castle into the center group's sky above the hero; place the mushroom and princess sign wherever they fit; shrink glows (sun bloom) to the center's 100 columns. Make sky dabs, waves, foam, grass and sand in each seam periodic with the seam's width (seed the texture by `x mod width`). Flat horizon, shoreline and ground line across seams. Record each part's box as it is drawn.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test plugins/heros-shore/art/test/`
Expected: all pass.

- [ ] **Step 5: Regenerate and look at the static scene**

Run (from `plugins/heros-shore`): `node art/gen.mjs hooks/scene.ts <scratchpad>/preview.html`
Then open the preview in the browser pane at 1920×1080, 1440×900 and 390×844, in light and dark. Expected: one finished scene, the groups whole at 16:10, open sea between them, no visible seam joins, hero framed on the phone size.

- [ ] **Step 6: Commit** `feat: recompose heros-shore into anchored groups with tileable seams`

### Task 3: Shader mapping

**Files:**
- Modify: `plugins/heros-shore/hooks/shore.ts`
- Test: `plugins/heros-shore/art/test/shader-sync.test.mjs`

**Interfaces:**
- Consumes: Task 1's math and constants, Task 2's `EFFECTS`.
- Produces: in `shore.ts`, top-level `const` numbers named exactly `L0, L1, SL0, SL1, C0, C1, SR0, SR1, R0, R1, V0, V1, FIRE_X, FIRE_Y, CRYSTAL_X, CRYSTAL_Y, HERO_X0, HERO_Y0, HERO_X1, HERO_Y1, SIGN_X0, SIGN_Y0, SIGN_X1, SIGN_Y1, SEA_TOP, SEA_BOTTOM, SUN_X`, and the picture pass computing `freeLeft`, `freeRight`, `oL`, `oC`, `oR` and the source column exactly as Task 1 does.

- [ ] **Step 1: Write the failing test** `shader constants match the layout`: parse each `const NAME = <number>` from `shore.ts` and assert it equals the matching value from `layout.mjs` (`LEFT`, `SEAM_L`, `CENTER`, `SEAM_R`, `RIGHT`, `VISIBLE`, `EFFECTS`).

- [ ] **Step 2: Run it and see it fail**

Run: `node --test plugins/heros-shore/art/test/`
Expected: FAIL, constants missing.

- [ ] **Step 3: Port the mapping into `shore.ts`.** Replace the 0.3.0 shrink-fit: keep `sC` and `uvAt` as they are; compute the box edges in px from `composer` and `size`, the free columns, the three offsets and the source column in the picture pass (no buffer reads in that chain). Sample `scene.sample(uvAt(vec2(sourceColumn + 0.5, cellY)))`. Run ripple, glints, shimmer and glows in source-scene coordinates, so they follow the art and apply in repeated seams. Keep the 1×1 `state` buffer for sky color and day/night only.

- [ ] **Step 4: Run the test and validate**

Run: `node --test plugins/heros-shore/art/test/` then `"<app claude.exe>" plugin validate plugins/heros-shore`
Expected: tests pass; validation passes; `shader hooks/shore.ts` reports sharpness `2.00 fast` and at least `1.48 weak`.

- [ ] **Step 5: Type-check** with the tsconfig recipe from the types file header (target es2023, jsx react/h, include the types file and `plugins/heros-shore/hooks`). Expected: exit 0.

- [ ] **Step 6: Copy `hooks/` into the live mod** (`C:\Users\jason\.claude\dev-mods\2c983115-04ef-441d-ada6-ae24502f7e41\heros-shore\hooks\`) so it reloads in the session, then commit `feat: pin heros-shore's groups to the free area in the shader`.

### Task 4: Layout debug view, then stop for Jason

**Files:**
- Modify: `plugins/heros-shore/hooks/register.tsx`
- Modify: `plugins/heros-shore/hooks/shore.ts`

**Interfaces:**
- Produces: a `/shore-layout` command (registered in `session.start`, answered by `on('command.run', { command: 'shore-layout' }, …)` returning `{ text }`), toggling a module-level flag passed as `<Shader module="./shore.ts" values={{ debug: on ? 1 : 0 }}>`; `shore.ts` declares `values({ debug: [0, 1] })`.

- [ ] **Step 1: Implement the toggle** in `register.tsx` (redraw with `$.ui.invalidate('ui.render')`) and, in `shore.ts`, when `debug > 0.5`: a 1-px cyan line at each free-area edge, a 1-px magenta line at each prompt-box edge, and tints over the placed left (red), center (green) and right (blue) groups at 25% alpha.

- [ ] **Step 2: Validate and copy to the live mod**

Run: `"<app claude.exe>" plugin validate plugins/heros-shore`
Expected: passes; sharpness unchanged with debug off.

- [ ] **Step 3: Commit** `feat: add a /shore-layout debug view`

- [ ] **Step 4: STOP: Jason measures.** Ask Jason to run `/shore-layout` and, for each setup (no panels; left; right; both; a narrow window), report whether the cyan lines sit on the panel edges, with a screenshot if easier. From the magenta lines in the "both" and "narrow" cases, record the box's maximum width in px and its margin to the free area's edges. Do not start Task 5 until these numbers are in.

### Task 5: Solve both panels from the measured box

**Files:**
- Modify: `plugins/heros-shore/art/layout.mjs`, `plugins/heros-shore/art/test/layout.test.mjs`, `plugins/heros-shore/hooks/shore.ts`

**Interfaces:**
- Produces: `export const BOX_MAX_PX`, `export const BOX_MARGIN_PX` in `layout.mjs` (Jason's measured values), mirrored in `shore.ts` as `BOX_MAX_PX`, `BOX_MARGIN_PX` and covered by the sync test.

- [ ] **Step 1: Write the failing test** `both panels solved when the box is narrow`: with the box narrower than `BOX_MAX_PX − 1`, `estimatePanels` returns `leftPx` and `rightPx` within 2 px of the true panel widths for left 300 / right 576 on a 1440 window; with the box at full width it falls back to the one-sided estimate.

- [ ] **Step 2: Run it and see it fail.** `node --test plugins/heros-shore/art/test/`; expected FAIL.

- [ ] **Step 3: Implement** in `estimatePanels`: when the box is narrower than `BOX_MAX_PX − 1`, `free = boxWidth + 2·BOX_MARGIN_PX`, `left + right = windowPx − free`, `left − right = 2·shiftPx`; solve and clamp each to at least 0. Mirror it in `shore.ts`, with a comment saying how the numbers were measured.

- [ ] **Step 4: Run tests, validate, copy to the live mod.** Expected: tests pass; sharpness unchanged.

- [ ] **Step 5: Commit** `feat: solve both panels from the prompt box's width`

### Task 6: Release 0.4.0

**Files:**
- Modify: `plugins/heros-shore/.claude-plugin/plugin.json` (`"version": "0.4.0"`), `README.md`, `CLAUDE.md`

- [ ] **Step 1: Document.** README: the scene keeps its art beside panels on either side. CLAUDE.md: the five column ranges and `layout.mjs` as the single source, the shader mirror and its sync test, `node --test plugins/heros-shore/art/` as the test command, and the prompt-box limits.

- [ ] **Step 2: Verify everything**

Run: `node --test plugins/heros-shore/art/`; from each plugin folder, regenerate the scene to a temp file and `cmp` it with `hooks/scene.ts` (ignoring line endings); validate both plugins and the marketplace with the app's Claude Code; run the secrets scan on the repo.
Expected: tests pass; both scenes identical; validation passes with the sharpness goal; no secrets.

- [ ] **Step 3: Jason's check in the app**, in light and dark: no panels; left only; right only; both; a narrow window. Fix what he reports before going on.

- [ ] **Step 4: Ship.** Commit `feat: release heros-shore 0.4.0 with anchored layers`, push `feat/anchored-layers`, open a PR into `omega` that says it replaces #4, close #4 with a comment linking the new PR, and ask Jason before merging.
