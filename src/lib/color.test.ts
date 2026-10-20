import { describe, expect, it } from 'vitest'
import { hexError, normalizeHex, onColor } from './color'

describe('normalizeHex', () => {
  it.each([
    ['#2563EB', '#2563EB'],
    ['#2563eb', '#2563EB'],
    ['2563eb', '#2563EB'],
    ['#fa0', '#FFAA00'],
    ['FA0', '#FFAA00'],
    ['  #0e0e0e  ', '#0E0E0E'],
  ])('accepts %s', (input, expected) => expect(normalizeHex(input)).toBe(expected))

  it.each(['', '#', '#12', '#1234', '#12345', '#1234567', '#GGGGGG', 'red', '##123456'])('rejects %j', (input) =>
    expect(normalizeHex(input)).toBeNull(),
  )
})

describe('hexError', () => {
  it('returns null for valid values', () => {
    expect(hexError('#2563EB')).toBeNull()
    expect(hexError('#abc')).toBeNull()
  })
  it('explains what is wrong', () => {
    expect(hexError('')).toMatch(/Saisissez une couleur HEX/)
    expect(hexError('#12Z')).toMatch(/0–9 et A–F/)
    expect(hexError('#1234')).toMatch(/3 ou 6 caractères/)
  })
})

describe('onColor', () => {
  it('picks readable ink', () => {
    expect(onColor('#FFFFFF')).toBe('#0E0E0E')
    expect(onColor('#F2A900')).toBe('#0E0E0E')
    expect(onColor('#0E0E0E')).toBe('#FFFFFF')
    expect(onColor('#003A96')).toBe('#FFFFFF')
  })
})
