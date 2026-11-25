# claude-themes

Retro JRPG themes for the Claude desktop app. Each theme recolors the app and puts an animated
pixel-art scene behind your sessions, with a daytime version for light mode and a night version
for dark mode.

| Theme | Look |
|---|---|
| **sky-realm** | 16-bit. A hero raising a sword twice his height, a hopping blue slime, an airship with a pink stowaway slime, and a floating castle with a waterfall. Day sky or starry night; blue menu-window colors. |
| **heros-shore** | 32-bit. A coast at golden hour or by moonlight: a hero with a glowing crystal sword, a slime, a palm with signposts, a floating crystal, a retro computer, a floating castle, a cliffside fortress, a mushroom guide, guitars and a campfire. Sand-and-sea colors by day, moonlit indigo by night. On desktop a GPU shader ripples the sea, scatters glints along the sun or moon path and under your pointer, and adds heat shimmer and firelight. It also notices the left sidebar and refits the scene into the space beside it. |

Install one theme at a time: a session shows a single theme, so with two installed, whichever
loads last wins.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install heros-shore --marketplace jasonblacksmith/claude-themes
```

From a shell:

```
claude plugin install heros-shore --marketplace jasonblacksmith/claude-themes
```

Answer `y` to add the marketplace, then pick a scope (user scope applies it everywhere). Swap
`heros-shore` for `sky-realm` to get the other theme.

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then
**Plugins**, **Add marketplace** with `jasonblacksmith/claude-themes`, then **Add plugin**.

The scene draws in the desktop and mobile apps. The terminal and editors keep their own look.

## How a theme is built

Each theme is a hooks-module plugin under `plugins/<name>/`:

- `hooks/register.tsx` sets the colors and backdrop at session start and draws the scene.
- `hooks/palette.ts` holds the few anchor colors; `hooks/make-colors.js` (copied unchanged from
  Claude Code) expands them into the full design-system palette.
- `hooks/scene.ts` is the generated SVG scene. Don't edit it by hand.
- `art/gen.mjs` draws the scene: sprites on a pixel grid, compiled to SVG paths.
- `hooks/shore.ts` (heros-shore only) is a shader in Claude Code's shader language, played on
  the GPU over the scene. Where it can't play (mobile, Reduce Motion, a slow GPU) the plain
  scene shows, so the SVG is always a finished picture on its own.

To change a scene, edit its `art/gen.mjs` and regenerate from the plugin folder:

```
node art/gen.mjs hooks/scene.ts preview.html
```

`preview.html` opens in any browser. The scene must stay under 131,072 characters and pure
vector (no embedded images or fonts); the generator refuses to write one that is too big.

## License

MIT. All art is original.
