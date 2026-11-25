# Hero's Shore: anchored layers

Status: draft for approval · 2026-11-24 · plugin `plugins/heros-shore`

## Intent

Hero's Shore is a pixel-art backdrop drawn behind Claude desktop sessions. The desktop app
can open panels on the left (the session sidebar), on the right (browser, diff, tasks and
other panes), on both sides, or on neither. The panels sit on top of the backdrop. Today a
right panel covers the cliff, guitars, campfire and books, and the left-sidebar fit added
in 0.3.0 shrinks the whole scene, which makes pixels uneven (some cells 2 screen pixels
wide, some 3).

The goal is a scene that recomposes for whatever space the panels leave free, the way 2D
games handle any screen shape: compact groups of art pinned to the edges of the free
space, with plain sky, sea and shore repeating to fill the gap between them. Jason picked
this approach over extending the 0.3.0 shrink-fit to the right and over a static safe-area
redraw.

## The sizing target (decided)

The shader can't scale the scene without uneven pixels, so the free area is always
narrower than the window, and the art must be laid out to fit it. On a 1440×900 window
(16:10) the picture shows about 432 of the scene's 480 columns, at about 3.33 screen pixels
per column. The free area is then about:

| Panels | Free columns |
|---|---|
| none | ~432 |
| left sidebar (~300 px) | ~342 |
| right pane (~40% of the window) | ~260 |
| both | ~170 |

**Target: all three groups fit whole, side by side, in about 250 columns.** That covers the
sidebar alone and a right pane of about 40%. With no panels, the extra width shows as open
sea between the groups. With both panels open, or a right pane wider than about 40%, the
center group stays whole and the outer groups slide under the panels, outer edge first.

Group budgets (a guide for the builder, inside the 250 total): left about 75 columns,
center about 100, right about 75.

## Goals

- With the sidebar alone, a right pane up to about 40%, or no panels, all three groups of
  art show whole in the free area:
  - **Left group:** palm with signs, crystal portal, retro computer, d20, gamepad, chest.
  - **Center group:** hero and slime on the stone ledge, the sand path's top, the sun or
    moon with its glitter path.
  - **Right group:** cliff with fortress and waterfalls, campfire, guitars, amp, books.
  - The floating castle, the mushroom guide and the princess sign are placed by the
    builder in whichever group fits the budgets best (Jason agreed they may move).
- With both panels open, the hero and slime always show; the rest slides under the panels.
- Pixels stay crisp: every cell drawn at the picture's own scale, moved only in whole
  cells.
- Window resizing keeps working as it does now.
- Sharpness stays where 0.3.0 is: `claude plugin validate` reports 2.00 on a fast GPU, with
  a weak GPU no worse than 1.48, at 30 fps.
- Without the shader (mobile, Reduce Motion, a GPU too slow), the plain SVG shows a
  finished scene: the compact groups with open sea between them.

## Non-goals

- Sky-realm. It gets no shader and keeps its current static layout.
- Smooth transitions when a panel opens or closes. Layout snaps, as in 0.3.0; easing it
  through a buffer read costs sharpness (see CLAUDE.md).
- Changing the vertical crop. The shader can only re-sample the picture the Svg drew, at
  the Svg's own scale. A very wide window keeps cropping the scene's top and bottom.
- Showing columns the Svg's `slice` crops away. On windows narrower than 16:10, the outer
  edges of the outer groups are lost, as they are today (decided).

## Anti-goals

- Blurry or uneven pixels.
- Key art (hero, slime, either outer group's centerpiece) cut in half by a seam, or by an
  edge of the free area while the target says there is room for it.
- Visible repetition seams or streaks in the filler: a repeated strip must tile cleanly.
- A static SVG fallback that looks broken or half-composed.
- Recognizable third-party characters, logos or brands (house rule in CLAUDE.md).

## Constraints

- **The backdrop is pure vector,** under 131,072 characters (`art/gen.mjs` enforces it). The
  shader language is `claude-code/shader`: TypeScript that is compiled, not run; see the
  types the engine writes into `.claude-plugin/types/`.
- **The shader cannot draw new art.** It can only re-sample the scene picture
  (`scene.sample(uv)`) and add light. Moving a group means sampling the picture at an
  offset, so each group must occupy its own column range in the picture, separated by
  seam strips that hold only filler.
- **The picture only holds what the Svg shows.** Columns cropped by `slice` are not in the
  picture and can't be sampled. So every group must sit inside the columns visible at
  16:10: x 24 to 456.
- **Panel detection has one signal:** `composer` (the prompt box: left, bottom, right, top,
  0 to 1 of the window). The box is centered in the free area, so
  `center − 0.5 = (L − R) / 2` in window fractions, where L and R are the left and right
  panels' widths. That gives the difference, not each width. When the free area is
  narrower than the box's maximum, the box's own width also tracks the free width, which
  pins down both. The box's maximum width and side margins are unknown and must be
  measured in the app.
- **Performance rule from 0.3.0:** a scene lookup whose position depends on a buffer read
  drops sharpness badly. Layout must be computed from `composer` and `size` in the picture
  pass.

## Approaches considered

1. **Extend the 0.3.0 shrink-fit to the right.** Small and quick. Keeps uneven pixels,
   still scales the whole scene down. Not picked.
2. **Anchored layers (picked).** Compact groups pinned to the free area's edges, filler
   repeated between them, no scaling. Crisp, the standard game-engine answer to arbitrary
   aspect ratios. Costs a recomposed scene and a new shader mapping.
3. **Safe-area recomposition.** Redraw so key art avoids both edges, no detection. Simplest
   and works on mobile, but the middle of the window is where chat text sits, so the art
   would hide behind the conversation. Not picked.

## Design

### The scene, recomposed in five column ranges

`art/gen.mjs` lays the 480×270 scene out left to right as:

```
| Left group | seam L | Center group | seam R | Right group |
```

within the columns visible at 16:10 (24 to 456), with the groups held to the budgets above
and the seams taking up the rest.

- Each **group** keeps all of its art (sprites, glows, animation, its share of sky, sea and
  land) inside its column range. Glows shrink to fit (the sun's bloom is 180 columns across
  today). Items may move between groups, be rearranged, or be redrawn smaller where the
  budget needs it, keeping the same characters and props.
- Each **seam** holds only filler: sky bands with cloud dabs, sea with waves, the shore
  foam, and the grass or sand under it. Every filler texture in a seam tiles horizontally
  with the seam's own width as its period, so repeating the seam shows no join. Things
  that vary across x (glitter path, glows, land slopes) stay out of seams.
- Seams sit at the same heights everywhere: the horizon line, the shoreline and the ground
  line are flat across each seam and meet the groups at matching heights.
- The static SVG reads as one finished scene: with no shader, the seams are simply
  stretches of open sea and sky between the groups.
- The SVG's phone-only rule (`@media (max-aspect-ratio: 1/1)`, which today shifts the hero
  and slime 40 columns right) is recomputed so the hero and slime stay inside the center
  group's columns.

### The shader mapping

The picture pass computes, per pixel, which scene column to sample:

1. **Free area.** From `composer`, estimate L and R (window fractions). With only the
   center shift known, attribute it all to one side: shift right means a left panel of
   width 2·shift, shift left means a right panel of width 2·|shift|. When the box is
   narrower than its measured maximum, use its width to solve for both.
2. **Placement, in whole scene cells.** Convert the free area to scene cells at the
   picture's scale `sC`. Place the left group with its left edge at the free area's left
   edge, the right group with its right edge at the free area's right edge, and the
   center group centered between them. Round every offset to a whole cell.
3. **Filler.** Columns between placed groups sample the nearer seam, wrapped by its width
   so it repeats.
4. **Not enough room** (free area under the 250-column target). Keep the center group whole
   and centered in the free area; the left and right groups keep their anchors and slide
   under the panels, so their outer parts are lost first.
5. **Effects** (sea ripple, glints, heat shimmer, firelight, crystal glow) run in scene
   coordinates after the mapping, so they follow the art. Ripple and glints apply in seams
   too, so the repeated sea moves.

With no panels on a 16:9 window, the result matches the static SVG.

### Measuring the prompt box (a stop in the middle of the build)

The box's maximum width and its margins inside the free area decide how well "both panels
open" can be solved, and only someone looking at the desktop app can measure them: the
shader can't run in a browser and sends nothing back to the mod.

So the build stops once for Jason. First build a debug view, toggled by a slash command the
mod registers (`/shore-layout`), that passes a `values` flag to the shader to draw the
detected free area and the group placements as outlines, with the box's measured edges
marked. Jason toggles each panel setup (none, left, right, both, a narrow window) and
reports what lines up and what doesn't, with a screenshot if that's easier. Then hard-code
the measured numbers in `shore.ts`, with a comment saying how they were found. Everything
except the two-panel solve can be built and checked before that stop.

### Versioning and delivery

- Branch `feat/anchored-layers`, cut from `feat/sidebar-aware` (PR #4, heros-shore 0.3.0,
  still open). The new PR replaces #4, which is closed unmerged with a pointer to it.
- heros-shore goes to 0.4.0. README and CLAUDE.md describe the anchored layout and the
  `composer` limits.
- Done means: the plugin validates with the sharpness above, both scenes still regenerate
  byte-for-byte, and Jason has checked in the desktop app, in light and dark, with: no
  panels; left only; right only; both; and a narrow window.

## Left to the builder

- Exact column ranges, seam widths (wide enough to tile cleanly; 16–24 columns is a guide)
  and which group the floating castle, mushroom and sign go in.
- How to rearrange and resize items within each group to fit its budget.
- How to make each filler texture periodic in `gen.mjs`.
- The exact estimate of L and R from `composer`, once measured.
- Whether to unit-test the column mapping with a plain TypeScript or JavaScript copy of it.
  The shader itself can only be checked in the app.
- Shader cost tuning, within the sharpness goal.

## Calls made while writing this (for Jason to check)

- Group budgets of about 75 / 100 / 75 columns.
- Groups kept inside columns 24 to 456, so nothing is cut on a 16:10 window.
- The phone-only hero shift is kept and recomputed, not removed.
- With both panels open, the center group wins and the outer groups slide under.
- PR #4 is replaced, not merged first.
