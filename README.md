# HONEG 3D Customizer — MVP

A browser-based 3D T-shirt configurator for HONEG, built by Lunar Innovate. Users set garment colors, print all-over patterns per zone, upload a logo, then move, resize and rotate it directly on a real-time 3D raglan tee, and export a preview image or the design file.

Branding (logo, palette, type direction) follows [honeg.fr](https://www.honeg.fr/): ink `#0E0E0E`, paper `#F6F5F2`, amber `#F2A900`, graphite greys. The UI uses Manrope; Unbounded stands in for the brand's commercial Benzin display face.

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

The garment is `public/models/honeg-raglan-tee.glb` (≈ 490 KB). It's generated from the supplied source file `men-regular-apparel-fit-sporty-t-shirt.zip → source/REGLAN TEE_4k_Pd5.glb` (Substance Painter export, 29.7k triangles, 20 MB with 4K textures):

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

## Logo controls

The editing model is ported from the editor in [OpenMerch Engine](https://github.com/osmaar/openmerch-engine) (`packages/editor`, MIT). Their 2D Konva canvas behaviors were adapted to a 3D garment. OpenMerch itself ships no 3D preview or 3D model; its roadmap lists 3D as "not planned".

| OpenMerch (2D Konva) | Here (3D garment) |
| --- | --- |
| Click a layer to select; click the stage to deselect | Click the logo on the shirt; click empty space or plain fabric to deselect. Selected automatically after upload |
| `draggable` when selected | Drag the print across the fabric. The pointer is projected onto the plane the print faces, so it stays stable at the silhouette |
| Transformer handles | Corner handles resize proportionally (logos aren't stretched); constant on-screen size, larger hit areas on touch |
| Rotate anchor, `rotationSnaps` every 45°, tolerance 8° | Top rotate knob, same snaps; hold **Shift** for free rotation |
| Snap guides to print-zone center and edges (6 px) | Same, 8 px, drawn as dashed guides on the garment; hold **Alt** to place freely |
| Contextual ImageToolbar | Floating toolbar: Replace · Fill color · Opacity · Position (3×3 align grid + Lock) · Transform (rotate, flip H/V, reset all) · Delete · Done |
| Arrow keys nudge (Shift = ×10), Delete removes | Arrows nudge 2 mm (Shift = 1 cm), Delete/Backspace removes, Esc deselects |
| "Reset all transforms" keeps opacity/tint | Same semantics |

Not ported, because it isn't relevant to a single printed logo or needs a server: skew, filters, crop, AI background removal (their `rembg` service), layer ordering, duplicate/copy/paste. The sidebar sliders (size, rotation, position) stay in sync with the on-model handles for precise numeric entry.

The print is a projected decal (`DecalGeometry`), so it needs no UVs and follows the fabric folds. The selection gizmo and print-area frame are flagged `uiOnly` and are hidden from exported images.

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
    layout/                     TopBar, CustomizerSidebar (5-step workflow)
    steps/                      ProductStep, ColorStep, PatternStep, LogoStep, ReviewStep
    pattern/PatternLibrary.tsx  searchable, filterable pattern swatches
    color/ShirtColorPicker.tsx  presets + visual picker + validated HEX, one value
    logo/                       LogoUploader, PlacementPicker, LogoTransformControls,
                                LogoToolbar (contextual toolbar + popovers)
    viewer/                     ProductViewer3D (DOM shell, fallback, overlays)
                                ViewerCanvas → Scene → Garment (lazy three.js part)
                                garmentModel.ts  GLB adapter (regions, normalisation)
                                LogoLayer / LogoGizmo / gizmoDrag  print + on-model handles
                                decal.ts         projection onto the garment
                                usePatternTextures.ts  zone pattern tiles → repeating textures
                                CameraRig.tsx    views, zoom, reset, PNG capture
                                FlatPreview.tsx  SVG flats (thumbnails, fallback, exports)
    summary/                    DesignSummary, StageSummary
    ui/                         Segmented, RangeField, Switch, Menu, ConfirmDialog, Toaster
  garments/
    types.ts                    garment contracts (regions, print areas, placements)
    catalog.ts                  product list ← edit this to add/replace models
    flat/                       2D silhouette for flats (not used for 3D)
  patterns/                     pattern library (adapted from inkjet) + descriptions
  state/                        design schema + validation, store (undo/redo, clamping), UI store, actions
  lib/                          color, logo file processing, transform/snap math, persistence
scripts/prepare-model.mjs       garment GLB preparation (region split, texture strip, pattern-ready UVs, quantize)
public/models/                  prepared garment models
```

**One source of truth.** `designStore` holds product, colors, per-zone patterns, the logo asset and its placement and appearance (size, rotation, offset, flip, fill, opacity, lock). The 3D scene, gizmo, toolbar, sidebar sliders, 2D flats, summary and exports all read from it. Every change is clamped to the printable area. A drag, slider move or nudge sequence is a single undo step.

## Feature checklist

| Feature | Notes |
| --- | --- |
| 3D preview | Real raglan tee model; orbit, zoom, front/back/left/right views, reset, full screen |
| Shirt color | 12 presets (HONEG palette), visual picker, HEX input with inline errors, reset |
| Separate sleeve / collar colors | From the model's UV-island split |
| All-over patterns | 69 patterns (from inkjet) per zone: search and categories, ink color, size, angle, density, opacity, shuffle, apply to all zones |
| Logo upload | PNG (transparency kept), JPG, SVG (sanitized), 5 MB limit, signature check, border trim, low-res warning, HONEG sample logos |
| Placement | Left / center / right chest, upper / center back, with a printable-area frame on the shirt |
| On-model editing | Select, drag, corner resize, rotate with snaps, snap guides, toolbar, keyboard (see Logo controls) |
| Undo / redo | Buttons + Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y |
| Save / export / import | Saved in this browser (restored on load); JSON export/import with validation (older exports still load); branded PNG preview |
| Fallbacks | No WebGL or a failed load → live 2D flat preview, with the same toolbar and exports |
| Responsive | Desktop two-panel; preview above controls on tablet/phone; side by side on landscape phones |

## Production-readiness gaps

- **Model license:** confirm the source model's license and attribution (see above).
- **Color accuracy:** calibrate screen colors against fabric/Pantone swatches; the on-screen color is indicative.
- **Print rules:** per-technique rules (screen print vs DTF vs sublimation), minimum line weights, DPI checks at print size, vector artwork handoff.
- **Product scope:** multiple logos and text layers (OpenMerch's layer model is a good reference), sizes, quantities and pricing, which need a backend.
- **Persistence and sharing:** server-side saved designs, shareable links, asset storage instead of data URLs.
- **Testing:** browser end-to-end tests in CI (the dev build exposes `window.__honeg` and `window.__honegGizmo` for this), plus visual regression tests.
- **Performance:** an adaptive pixel ratio on low-end phones, and KTX2 textures if future models ship real texture maps.
