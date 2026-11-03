# Sportswear pattern library

Seeded, layered, print-ready patterns for the configurator. The code is original, in TypeScript, with no dependencies. The browser is only needed to rasterise (`toCanvas`, `exportForPrint`). Everything else also runs in Node.

- **Deterministic.** All randomness comes from one `mulberry32` stream seeded by type and seed. Geometry uses only `+ − × ÷ √` and the library's own sine and cosine (`math.ts`), never `Math.sin`, whose last bits can differ between browsers. The same type, seed and options therefore give a byte-identical SVG on every device: what the customer sees is what the factory prints. A test pins the flagship preset's output, so an accidental generator change shows up before it alters saved designs.
- **Layered.** Every pattern is a seamless 1000 × 1000 tile. Each colour is one `<g data-layer="i">`, and only those groups carry colours, so recolouring never touches geometry. Layer 0 is a full-tile base, and in the configurator it is the zone's fabric colour.
- **Flat colours only.** There are no gradients or transparency inside shapes, which suits sublimation and zone recolouring. Adjacent colours overlap by a hair ("trapping"), so no hairline of base shows between them.
- **Seamless.** Shapes crossing an edge are drawn again on the other side, noise fields wrap, and directional bands follow integer steps that close on the tile (`torusFrame`). The tile can repeat in any direction without a visible seam.

## API

```ts
import { generatePattern, recolor, toCanvas, exportForPrint } from './patterns'

const { svg, layers } = generatePattern('shards', {
  colors: ['#1F5BD8', '#14234A', '#5FB3E8', '#F2762E', '#0E0E12'], // base first, 3–6 used
  seed: 7,
  scale: 1,    // feature size 0.5–2
  angle: 28,   // main direction (types that have one)
  density: 0.5 // amount of detail 0–1
})

recolor(svg, ['#FFFFFF', '#000000'])               // layer i gets colors[i]; others keep theirs
toCanvas(svg, 2048)                                 // HTMLCanvasElement, synchronous (Path2D)
await exportForPrint(svg, { dpi: 300, widthMm: 550, heightMm: 550, tileMm: 550 })
// → { png: Blob (dpi recorded in a pHYs chunk), svg: Blob (true size in mm, repeats clipped) }
```

Other exports:
- `PATTERN_TYPES`, `PALETTES`, `PRESETS` and `SPORTS`.
- `layerColors(svg)`, `countLayers(svg)` and `geometryOf(svg)` (the SVG with colours stripped, used in tests).
- `parseLayered(svg)` / `isLayered(svg)`: strict reader and validator for the layered format.
- `printSvg` and `printPixels` (print size and canvas limits).
- `randomSeed()`.

`exportForPrint` refuses PNGs that are too large for a browser canvas (over 16384 px a side or 120 MP; iOS Safari stops at 16.7 MP) and says why. The SVG has no size limit.

## Types

| Type | Layers | Uses | Look |
|---|---|---|---|
| `shards` | 3–6 | scale, angle, density | Fractured camo: blades on 3 dominant directions, sharp cut ends, splinters off the big blades, hairline slivers on top |
| `lowPoly` | 3–6 | scale, angle, density | Jittered triangle grid coloured by a diagonal wave plus noise, quantised to the inks, with faceted dithering at boundaries |
| `digitalCamo` | 3–5 | scale, density | Pixel camo: one blob field per ink on a 2 × 2 block grid with single-pixel detail; coverage set exactly by quantiles |
| `chevrons` | 3–5 | scale, angle, density | Runs of arrowheads along a band, growing towards the head; optional pinstripes |
| `speedLines` | 3–5 | scale, angle, density | Tapered streaks packed into a curving swoosh band, heavy in the core and fine at the edges |
| `bands` | 3–5 | scale, density | Cycling kit: chest band with pinstripes and, by seed, a second band and a diagonal sash |
| `topo` | 3–5 | scale, density | Contour lines (marching squares) alternating colours, with every 4th line a bold index contour |
| `elevation` | 3–6 | scale, density | Mountain ridges back to front, plus a climb-profile line with a summit flag |
| `waves` | 3–6 | scale, density | Phase-shifted wave bands that swell and pinch, with thin accent bands |
| `halftone` | 3–4 | scale, angle, density | Solid band fading to a 45° dot screen, with a second dot colour at the edge of the fade and an optional racing stripe |

Compositions such as `bands`, `chevrons` and `elevation` are designed to be printed with the tile about as tall as the garment. The configurator centres the tile on the chest (`patternOrigin` in the garment definition), so a chest band lands on the chest.

## Adding a pattern type

1. Create `generators/myType.ts` exporting a `PatternTypeDef`:
   ```ts
   export const myType: PatternTypeDef = {
     id: 'myType', minLayers: 3, maxLayers: 5, defaultAngle: 0,
     uses: { scale: true, angle: false, density: true },
     generate({ rng, inks, scale, angle, density }) {
       // Return `inks` layers, bottom to top: { d } for fills, { d, stroke: { width } } for lines.
       // Use only `rng` for randomness, and `dsin`/`dcos` from math.ts for trigonometry.
       // Draw shapes that cross an edge with `wrappedPoly` / `wrapOffsets`, and use wrapping noise.
     },
   }
   ```
2. Add the id to `PatternType` in `types.ts` and the def to `PATTERN_TYPES` in `generate.ts`.
3. Name it in `src/i18n/en.ts` and `fr.ts` (`pattern.types`). The i18n test fails until you do.
4. Add a preset or two in `presets.ts`. The tests check every type has one, and that it stays within its layer range.
5. Review it at **`/patterns-preview`** (dev server only): every type × 4 palettes × 2 seeds, a 2 × 2 repeat to check seams, and timing and size per tile.

The type tests run automatically for every entry in `PATTERN_TYPES`. They check:
- determinism and seed sensitivity
- layer counts
- valid layered output
- recolouring never changes geometry
- clamping of options
- file size

