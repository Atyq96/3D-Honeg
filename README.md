# Lunar 3D — 3D T-shirt customizer demo

A browser-based 3D T-shirt configurator by Lunar Innovate, shown as a brand-neutral demo: wherever a client brand would appear, it uses a "YOUR LOGO" placeholder. Users set garment colors, print all-over patterns per zone, upload up to three logos or photos, add text in a choice of fonts, then move, resize and rotate everything directly on a real-time 3D raglan tee, and export a preview image or the design file.

The app is branded **Lunar 3D** with the Lunar Innovate mark (`public/brand/lunar-logo.png`, tab icon `public/favicon.png`): ink `#0E0E0E` on paper `#F6F5F2` with an amber `#F2A900` accent and graphite greys. The UI uses Manrope, with Unbounded for display type.

## Languages

The interface is in **English** (the default) and **French**. The **EN | FR** switch in the top bar changes everything live: the UI, toasts, validation messages, the summary and the PNG export. The choice is remembered in the browser (`localStorage`), and it sets the page `lang` and title.

- **Dictionaries:** all text lives in `src/i18n/en.ts` and `src/i18n/fr.ts`. The French dictionary is typed against the English one, so a missing or misshapen translation fails the build. A test (`i18n.test.ts`) checks the same thing at runtime, and that every pattern, palette colour, zone, print position and product has a name in both languages.
- **Labels by id:** labels that belong to data (zone names, palette colours, the 69 pattern names, print positions, the product) are keyed by id in the dictionaries; the config files hold no display text.
- **Using it:** components call `useT()` and re-render when the language changes. Code outside React (toasts, exports, file and design validation) calls `t()`.
- **Numbers and typography:** numbers show with a decimal comma in French (`lib/format.ts`). French strings use a non-breaking space (` `) before `:` `?` `!` and inside « ».
- **Not translated:** saved and exported design files carry only ids, so a design made in one language opens in the other.

To add a language, copy `fr.ts`, translate it, and add it to `src/i18n/index.ts` and the switch in `LanguageSwitch.tsx`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command                                    | What it does                                        |
| ------------------------------------------ | --------------------------------------------------- |
| `npm run dev`                              | Vite dev server with hot reload                     |
| `npm run build`                            | Type-check + production build into `dist/`          |
| `npm run preview`                          | Serve the production build locally                  |
| `npm run check`                            | Type-check, lint and unit tests in one go           |
| `npm test`                                 | Unit tests (Vitest)                                 |
| `npm run prepare:model -- <in.glb> [out]`  | Prepare a garment GLB for the viewer (see below)    |

No backend, account or network service is required. Exports and saves stay on the user's device.

Useful URL flags:

- `?glb=/models/your-file.glb` previews any same-origin glTF/GLB in place of the current product.
- `?flat` forces the 2D fallback, which is what users get when WebGL is unavailable.

## Stack

React 19 · TypeScript · Vite 8 · three.js via React Three Fiber + Drei · Zustand (state + undo) · react-colorful (picker) · lucide-react (icons) · glTF-Transform (dev only, model prep). The three.js bundle is lazy-loaded after the UI paints.

## The 3D model

The garment is `public/models/raglan-tee.glb` (≈ 490 KB). It's generated from the supplied source file `men-regular-apparel-fit-sporty-t-shirt.zip → source/REGLAN TEE_4k_Pd5.glb` (Substance Painter export, 29.7k triangles, 20 MB with 4K textures):

```bash
npm run prepare:model -- "path/to/REGLAN TEE_4k_Pd5.glb"
```

`scripts/prepare-model.mjs` does four things:

1. **Splits the garment by UV island into `body`, `sleeves` and `collar` meshes.** Each pattern piece is its own UV island in this model (front, back, 2 sleeves, neck rib, neck tape). Collar = small islands at the top; sleeves = islands centered off the vertical axis; body = the rest. This is what makes separate sleeve and collar colors real rather than faked.
2. **Strips the baked textures.** They carry the source's own teal color and a "RUN" chest print, including in the normal map. The customizer supplies the color, a procedural knit normal map and the customer's logo.
3. **Makes the UVs pattern-ready.** Source layouts store pieces in any orientation (this one has the front panel upside down and mirrored). Each island is rotated or mirrored so +v points up the garment and +u to the viewer's right for its side. It's scaled so 1 UV unit = 1 m of fabric (from true surface area, so nothing gets squashed), and placed at its garment height. Patterns are then upright, true to size, and line up across the side seams.
4. **Compacts and quantizes the geometry** (`KHR_mesh_quantization`, decoded natively by three.js).

At load time, the viewer centers the model, puts the hem on `y = 0` and scales it to 0.72 m. Print areas and placement presets in `src/garments/catalog.ts` are measured in that space: torso half-width 17–19 cm, front neckline 0.644 m, back neckline 0.70 m.

> **License:** the source model came without a license file. Before production, confirm where it came from (the archive layout matches a Sketchfab download) and that its license allows commercial use and any required attribution.

### Using another model

1. Run `npm run prepare:model -- <file.glb> public/models/<name>.glb`. Or skip it if your file already has meshes named `body` / `sleeves` / `collar`.
2. Preview it with no code change: `http://localhost:5173/?glb=/models/<name>.glb`.
3. Add a `GarmentDefinition` in `src/garments/catalog.ts` with its URL, `uvScale` (`1` after `prepare:model`; otherwise metres of fabric per UV unit), print areas and placement anchors.

The adapter (`src/components/viewer/garmentModel.ts`) handles scale and orientation (`rotationY`), ignored meshes (`ignore`), and quantized files. If a model is a single mesh, the Color step offers main-color editing only rather than pretending sleeves and collar can be colored separately.

## Logos and photos

A garment carries up to **3** logos or photos (`MAX_LOGOS` in `src/state/design.ts`). Several files can be chosen or dropped at once; files beyond the limit are skipped with a notice.

- **Where new ones go.** Each new image gets its own print position: the free chest first, then the upper back, then the larger centre prints. It never goes on the brand mark's chest, and if possible it doesn't cover another logo.
- **Which one you're editing.** The list in the Logo step shows every image, front-most first. Selecting one, from the list or by clicking it on the shirt, makes it the one the placement cards, sliders, toolbar and keyboard shortcuts edit. Where logos overlap, a click selects the one on top.
- **Stacking.** Later images print over earlier ones. The list's arrows bring an image forward or send it backward.
- **Chest rule.** Two logos can't take both chests while the brand mark needs one. The blocked chest card says so instead of moving the mark onto another logo.
- **Photos.** JPG, PNG and WebP photos up to 10 MB are accepted. Images without transparency are stored as JPEG, which keeps three photos within browser storage. Transparent ones stay PNG.

Designs from before multiple logos (a single `logo` + `placement`) still import, as one layer.

## Text

The **Text** step adds up to **3** text blocks (`MAX_TEXTS`), counted separately from logos. Typical uses are a team name across the chest, a number on the back, or a slogan. Each block has:

- **Wording:** up to 3 lines of 32 characters, updated on the shirt as you type.
- **Font:** 9 bundled fonts, each previewed with your own wording. Anton (bold condensed), Bebas Neue (tall caps), Graduate (varsity numbers), Unbounded (wide display), Manrope, Playfair (serif), Black Ops One (stencil), Permanent Marker and Pacifico (script). All are under the SIL Open Font License and are bundled through Fontsource, so nothing loads from a font CDN.
- **Letter height:** in cm (the height of capital letters, as apparel printers quote it), with a slider and S / M / L / XL shortcuts (2, 4, 7, 10 cm). Sizes that won't fit the printable width are disabled.
- **Color:** the same palette swatches and HEX field as a logo's fill.
- **Alignment:** left, center or right, for multi-line text.

**How it prints.** `lib/textRender.ts` draws the text in black onto a canvas, cropped to the ink. The result goes through the same pipeline as an uploaded logo: projected decal, gizmo, keep-out clamp, flats and export. Its color is the layer's fill, so changing color never re-renders. The renderer also records the cap height in pixels. That turns the print width into a letter height, so new wording or a new font keeps the chosen letter height. Text that would overflow the print area is set smaller, and grows back when it's shortened.

New text goes across the chest first, then the upper back, then the center back. Default letter heights are 2 cm on a chest crest and 5–6.5 cm on the big prints. Clicking text on the shirt opens the Text step with that block selected.

## Logo controls

The editing model is ported from the editor in [OpenMerch Engine](https://github.com/osmaar/openmerch-engine) (`packages/editor`, MIT). Their 2D Konva canvas behaviors were adapted to a 3D garment. OpenMerch itself ships no 3D preview or 3D model; its roadmap lists 3D as "not planned".

| OpenMerch (2D Konva) | Here (3D garment) |
| --- | --- |
| Click a layer to select; click the stage to deselect | Click a logo on the shirt (or in the list); click empty space or plain fabric to deselect. Selected automatically after upload |
| `draggable` when selected | Drag the print across the fabric. The pointer is projected onto the plane the print faces, so it stays stable at the silhouette |
| Transformer handles | Corner handles resize proportionally (logos aren't stretched); constant on-screen size, larger hit areas on touch |
| Rotate anchor, `rotationSnaps` every 45°, tolerance 8° | Top rotate knob, same snaps; hold **Shift** for free rotation |
| Snap guides to print-zone center and edges (6 px) | Same, 8 px, drawn as dashed guides on the garment; hold **Alt** to place freely |
| Contextual ImageToolbar | Floating toolbar: Replace · Fill color · Opacity · Position (3×3 align grid + Lock) · Transform (rotate, flip H/V, reset all) · Delete · Done |
| Arrow keys nudge (Shift = ×10), Delete removes | Arrows nudge 2 mm (Shift = 1 cm), Delete/Backspace removes, Esc deselects |
| "Reset all transforms" keeps opacity/tint | Same semantics |
| Layer order | Bring forward / send backward in the logo list |

Not ported, because it isn't needed for printed logos or needs a server: skew, filters, crop, AI background removal (their `rembg` service), duplicate/copy/paste. The sidebar sliders (size, rotation, position) stay in sync with the on-model handles for precise numeric entry.

The print is a projected decal (`DecalGeometry`), so it needs no UVs and follows the fabric folds. The selection gizmo and print-area frame are flagged `uiOnly` and are hidden from exported images.

## Brand mark ("YOUR LOGO")

Every garment carries a brand mark on the chest, the way sportswear makers place their logo. It can't be removed. In this demo it's a neutral placeholder: a star badge with a "YOUR LOGO" wordmark (`src/assets/your-logo.png`, and `your-logo-symbol.png` for the badge alone). To brand the customizer for a client, replace those two images and their aspect ratios in `config/brand.ts`. In the Logo step's **Brand logo** section the customer picks:

- **Position:** wearer's left chest, centre, or right chest (right by default). Centred, it leaves both chests free for logos.
- **Style:** full logo (badge and wordmark) or symbol (badge only)
- **Color:** Auto (white on dark fabric, black on light), white, black or amber

The mark and the customer's own prints never collide:

- A chest logo and the mark never share a side. Choosing the mark's chest moves chest logos across, and choosing a chest preset for a logo moves the mark, as long as the other chest is free. A toast says what moved.
- Front prints are kept out of the mark's footprint plus a 1.2 cm margin. `clampTransform` moves an overlapping logo along one axis to the nearest clear spot, and only shrinks it if nothing fits.
- Saved or imported designs are checked the same way when they load.

The mark's position and size are set per garment (`brandMark` in `catalog.ts`). It's printed as a projected decal like the logo, and it appears in the 2D flats, the summary and the PNG export.

## Color zones

The Colors and Pattern steps work on **zones**. You pick each one by picture: the card shows the real 3D garment with that zone highlighted in amber.

| Group | Zones |
| --- | --- |
| Parts | Body, Sleeves, Collar (from the model's own meshes), Left sleeve, Right sleeve |
| Panels | Front, Back, Side panels, Shoulders (yoke) |
| Halves | Left half, Right half (sleeve included), Top half, Bottom half |
| Stripes | Chest stripe, Center stripe, Hem band, Sash |

Body, sleeves and collar always have a color. Every other zone is unpainted until you give it a color or a pattern, and **Clear zone** removes it again. Zones print over the parts in a fixed order, from big areas to details (`paintZones` in `catalog.ts`), so a stripe shows over a half. Left and right are the wearer's.

**How it works.** A zone is up to four planes in garment space, optionally mirrored across the centre line (side panels, centre stripe). Front and back are split by a plane that follows the side seam: the torso leans back towards the shoulders, so z = 0 would cut the shoulders wrongly. In 3D, each painted zone is drawn over its parts using the same geometry and fabric material, and a small shader addition (`zoneMask.ts`) discards fragments outside the planes. That gives crisp edges without splitting the mesh, and patterns line up with the part beneath. The 2D flats clip the same planes into polygons for each view. The picker thumbnails are rendered once per model in a separate small scene (`ZoneThumbnails.tsx`), with flat sketches as the fallback without WebGL.

The brand mark's **Auto** ink reads the fabric under the mark, including any zone painted over it. A red sash through the chest gets a white mark.

## Patterns

The **Pattern** step prints an all-over pattern on each zone (body, sleeves, collar), drawn over that zone's fabric color. The library (`src/patterns/library.ts`) has 69 patterns in 9 categories: stripes, checks, dots, geometric, animal, waves, floral, retro and tech. They're curated from [inkjet](https://github.com/Dragoon0x/inkjet) (MIT, © 2025 0xDragoon), a set of 500 parametric SVG tile patterns, and adapted for garments:

- **Print strength.** inkjet's renderers target subtle UI backgrounds (opacity multipliers of 0.03–0.15). Here they're re-tuned to print-strength ink.
- **Seamless tiles.** Scattered motifs wrap across tile edges and use jittered-grid placement, so the repeat isn't obvious on a garment. Hexagon-based motifs (honeycomb, tumbling blocks) use true hexagonal tiles.
- **Houndstooth from its weave.** It's generated from the actual weave (2/2 twill with 4-end color blocks).

Per zone you can set the ink color, repeat size (cm), angle, density (where the motif supports it) and opacity, re-shuffle scattered layouts, or apply one zone's pattern to every zone. Patterns are part of the design state, so undo/redo, save/load, JSON export/import, the 2D flats and the PNG export all include them.

In 3D, each pattern is rasterized once into a seamless tile texture and mapped through the model's metre-scaled UVs. Size and angle only change the texture transform, so dragging those sliders never re-rasterizes. Logos are projected decals, so they sit on top of any pattern.

## Architecture

```
src/
  components/
    CustomizerPage.tsx          page shell, undo + logo shortcuts, saved-design restore
    layout/                     TopBar, CustomizerSidebar (6-step workflow)
    steps/                      ProductStep, ColorStep, PatternStep, LogoStep, TextStep, ReviewStep
    pattern/PatternLibrary.tsx  searchable, filterable pattern swatches
    color/ShirtColorPicker.tsx  presets + visual picker + validated HEX, one value
    color/ZonePicker.tsx        parts, panels, halves and stripes as 3D thumbnails
    logo/                       LogoUploader (logo list + add), PlacementPicker, LogoTransformControls,
                                LogoToolbar (contextual toolbar + popovers), BrandMarkControls
    viewer/                     ProductViewer3D (DOM shell, fallback, overlays)
                                ViewerCanvas → Scene → Garment (lazy three.js part)
                                garmentModel.ts  GLB adapter (regions, normalisation)
                                LogoLayer / LogoGizmo / gizmoDrag  prints + on-model handles
                                BrandMark.tsx    the always-on brand mark
                                decal.ts         projection onto the garment
                                usePatternTextures.ts  zone pattern tiles → repeating textures
                                zoneMask.ts      paint zones drawn over their parts (shader mask)
                                ZoneThumbnails.tsx  3D picker thumbnails, rendered once per model
                                CameraRig.tsx    views, zoom, reset, PNG capture
                                FlatPreview.tsx  SVG flats (thumbnails, fallback, exports)
    summary/                    DesignSummary, StageSummary
    ui/                         Segmented, RangeField, Switch, Menu, ConfirmDialog, Toaster, InkPicker
  garments/
    types.ts                    garment contracts (regions, print areas, placements)
    catalog.ts                  product list ← edit this to add/replace models
    brand.ts                    brand mark placement and keep-out zone
    zones.ts                    paint zones: ids, labels, plane tests, flat-sketch polygons
    flat/                       2D silhouette for flats (not used for 3D)
  config/                       Lunar 3D identity, palette, brand mark assets and colors, text fonts
  i18n/                         en.ts (main) and fr.ts dictionaries, language store, useT() / t()
  patterns/                     pattern library (adapted from inkjet) + descriptions
  state/                        design schema + validation, store (undo/redo, clamping), UI store,
                                useActiveLogo (which logo is being edited), actions
  lib/                          color, logo file processing, text rendering, transform/snap math, persistence
scripts/prepare-model.mjs       garment GLB preparation (region split, texture strip, pattern-ready UVs, quantize)
public/models/                  prepared garment models
```

**One source of truth.** `designStore` holds product, colors, per-part patterns, painted color zones, the brand mark settings, and up to three logo layers, each with its image, placement and appearance (size, rotation, offset, flip, fill, opacity, lock). Which logo is being edited is UI state, not design state. The 3D scene, gizmo, toolbar, sidebar sliders, 2D flats, summary and exports all read from it. Every change is clamped to the printable area. A drag, slider move or nudge sequence is a single undo step.

## Feature checklist

| Feature | Notes |
| --- | --- |
| 3D preview | Real raglan tee model; orbit, zoom, front/back/left/right views, reset, full screen |
| Shirt color | 12 presets, visual picker, HEX input with inline errors, reset |
| Separate sleeve / collar colors | From the model's UV-island split |
| Color zones | 14 more zones (single sleeves, front/back, halves, side panels, shoulders, stripes, sash), each with a color and optional pattern, picked by 3D thumbnail |
| All-over patterns | 69 patterns (from inkjet) per zone: search and categories, ink color, size, angle, density, opacity, shuffle, apply to all zones |
| Logo upload | Up to 3 logos or photos, several at once; PNG (transparency kept), JPG, WebP, SVG (sanitized), 10 MB limit, signature check, border trim, low-res warning |
| Placement | Left / center / right chest, upper / center back, with a printable-area frame on the shirt |
| Brand mark | "YOUR LOGO" placeholder, always printed; left chest, centre or right chest, logo or symbol, auto/white/black/amber; customer prints keep clear of it |
| Text | Up to 3 blocks, 9 fonts, letter height in cm (slider + S/M/L/XL), palette or HEX color, multi-line alignment |
| On-model editing | Select, drag, corner resize, rotate with snaps, snap guides, toolbar, keyboard (see Logo controls) |
| Undo / redo | Buttons + Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y |
| Save / export / import | Saved in this browser (restored on load); JSON export/import with validation (older exports still load); branded PNG preview |
| Fallbacks | No WebGL or a failed load → live 2D flat preview, with the same toolbar and exports |
| Responsive | Desktop two-panel; preview above controls on tablet/phone; side by side on landscape phones |

## Production-readiness gaps

- **Model license:** confirm the source model's license and attribution (see above).
- **Color accuracy:** calibrate screen colors against fabric/Pantone swatches; the on-screen color is indicative.
- **Print rules:** per-technique rules (screen print vs DTF vs sublimation), minimum line weights, DPI checks at print size, vector artwork handoff.
- **Product scope:** sleeve prints, curved or outlined text, sizes, quantities and pricing, which need a backend.
- **Text for production:** text is rasterized for the preview; a print hand-off should send the wording and font (already in the design JSON) so the printer can set it as vectors.
- **Persistence and sharing:** server-side saved designs, shareable links, asset storage instead of data URLs.
- **Testing:** browser end-to-end tests in CI (the dev build exposes `window.__lunar3d`, `window.__lunar3dGizmo` and `window.__lunar3dThree` for this), plus visual regression tests.
- **Performance:** an adaptive pixel ratio on low-end phones, and KTX2 textures if future models ship real texture maps.
