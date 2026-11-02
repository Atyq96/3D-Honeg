import { useEffect, useRef } from 'react'
import { generatePattern, getPalette, PATTERN_TYPES, PRESETS, SPORTS, toCanvas, type PatternOptions, type PatternType } from '../patterns'

/**
 * Dev-only review page (/patterns-preview): every preset by sport, then every
 * pattern type × a few palettes × a few seeds, plus a 2 × 2 repeat of each to
 * check the seams, with generation time, file size and layer count.
 * `?type=shards` shows one type only; `?section=presets|types` one section.
 */

const PALETTE_IDS = ['electric', 'volt', 'peloton', 'lagoon']
const SEEDS = [7, 2024]

function Tile({ type, opts, label, repeat = 1, size = 220 }: { type: PatternType; opts: PatternOptions; label: string; repeat?: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const statsRef = useRef<HTMLSpanElement>(null)
  const key = JSON.stringify(opts)
  useEffect(() => {
    const t0 = performance.now()
    const { svg, layers } = generatePattern(type, JSON.parse(key))
    const t1 = performance.now()
    const tile = toCanvas(svg, size / repeat)
    const t2 = performance.now()
    const canvas = ref.current!
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    for (let y = 0; y < repeat; y++) for (let x = 0; x < repeat; x++) ctx.drawImage(tile, (x * size) / repeat, (y * size) / repeat)
    statsRef.current!.textContent = `gen ${(t1 - t0).toFixed(1)} ms · draw ${(t2 - t1).toFixed(1)} ms · ${(svg.length / 1024).toFixed(0)} KB · ${layers} layers`
  }, [type, key, repeat, size])
  return (
    <figure style={{ margin: 0 }} data-tile={label}>
      <canvas ref={ref} style={{ width: size, height: size, display: 'block', borderRadius: 6 }} />
      <figcaption style={{ font: '11px/1.4 system-ui', color: '#555', marginTop: 4, maxWidth: size }}>
        {label}
        <br />
        <span ref={statsRef} />
      </figcaption>
    </figure>
  )
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 12 } as const
const h2 = { font: '600 16px system-ui', margin: '0 0 8px' } as const

export function PatternsPreview() {
  const params = new URLSearchParams(location.search)
  const only = params.get('type')
  const section = params.get('section')
  const types = PATTERN_TYPES.filter((t) => !only || t.id === only)
  return (
    <main style={{ padding: 24, background: '#f4f3ef', height: '100vh', overflow: 'auto', boxSizing: 'border-box' }}>
      <h1 style={{ font: '700 22px system-ui', margin: '0 0 16px' }}>Pattern library preview</h1>
      {section !== 'types' &&
        !only &&
        SPORTS.map((sport) => (
          <section key={sport} style={{ marginBottom: 28 }}>
            <h2 style={h2}>Presets · {sport}</h2>
            <div style={row}>
              {PRESETS.filter((p) => p.sport === sport).map((p) => (
                <Tile key={p.id} type={p.type} label={`${p.id} · seed ${p.seed}`} opts={{ colors: p.colors, seed: p.seed, scale: p.scale, density: p.density, angle: p.angle }} size={200} />
              ))}
            </div>
          </section>
        ))}
      {section !== 'presets' &&
        types.map((t) => (
          <section key={t.id} style={{ marginBottom: 28 }}>
            <h2 style={h2}>
              {t.id} <span style={{ fontWeight: 400, color: '#777' }}>({t.minLayers}–{t.maxLayers} layers)</span>
            </h2>
            <div style={row}>
              {PALETTE_IDS.flatMap((p, i) =>
                SEEDS.map((s) => <Tile key={`${p}-${s}`} type={t.id} label={`${p} · seed ${s + i}`} opts={{ colors: getPalette(p)!.colors, seed: s + i }} />),
              )}
              <Tile type={t.id} label="2 × 2 repeat" opts={{ colors: getPalette(PALETTE_IDS[0])!.colors, seed: SEEDS[0] }} repeat={2} />
            </div>
          </section>
        ))}
    </main>
  )
}
