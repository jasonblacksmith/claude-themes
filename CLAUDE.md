# CLAUDE.md — claude-themes

Retro JRPG themes for the Claude desktop app, published as a plugin marketplace. House rules
come from the `CLAUDE.md` above this repo; this file adds what is specific here.

## Layout

- `.claude-plugin/marketplace.json` lists every theme. A new theme gets an entry here.
- `plugins/<name>/` is one theme: `.claude-plugin/plugin.json`, `hooks/` (what loads), `art/`
  (the scene generator, never loaded at run time).

## Commands

- Regenerate a scene, from the plugin folder: `node art/gen.mjs hooks/scene.ts preview.html`
- Validate a theme: `claude plugin validate plugins/<name>`. Use the Claude Code that the
  desktop app runs. An older `claude` on PATH does not know the `modules` hooks format.
- Develop live: load the plugin folder with `claude --plugin-dir plugins/<name>`, or build it
  in a session's mods folder through the `plugin-authoring` skill, which hot-reloads.

## Rules for scenes

- Under 131,072 characters, pure vector: no `<image>`, no embedded fonts, no CDATA, plain
  comments only. `gen.mjs` throws past the limit.
- `art/pixel.mjs` encodes sprites in painter's order (most-used color first, runs passing
  under later colors). Texture is cheap only as sparse strokes over a base fill; per-pixel
  noise is what blows the size budget.
- Motion stays slow (no flashing), every moving part has a resting position in the plain
  markup, and subjects stay clear of the middle (text) and the foot (message box).
- Original art only: no recognizable characters, logos or trademarked designs from games,
  shows or brands. Riffs on genre tropes are fine.

## Rules for shaders

- A shader file (`hooks/<name>.ts`, named in `<Shader module="./<name>.ts">`) is TypeScript
  against `claude-code/shader`, never GLSL. Its rules and built-ins are in the types Claude
  Code writes to `.claude-plugin/types/claude-code/index.d.ts`.
- It samples the scene through `scene.sample(uv)`. Map to scene cells (480x270, drawn with
  `slice`) and move things in whole cells so the pixel art stays crisp.
- `claude plugin validate` prints each shader's frame cost; keep a weak GPU near 10 ms at 30
  fps. The browser can't play these shaders, so check them in the desktop app.

## Rules for colors

- `hooks/make-colors.js` and `.d.ts` are copied unchanged from Claude Code's plugin-authoring
  skill. Never edit them; recopy them when the build updates and recheck the palette.
- A palette must produce no `Desktop won't paint` line from `makeColors`.
