import { slugify } from '@/lib/slug'

describe('slugify', () => {
  it('converts title to kebab-case', () => {
    expect(slugify('Meu Evento Legal')).toBe('meu-evento-legal')
  })

  it('removes accents', () => {
    expect(slugify('São Paulo 2025')).toBe('sao-paulo-2025')
  })

  it('removes special characters', () => {
    expect(slugify('Evento & Festa!')).toBe('evento-festa')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('Evento  --  Legal')).toBe('evento-legal')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  meu evento  ')).toBe('meu-evento')
  })

  it('lowercases everything', () => {
    expect(slugify('FOTO ESPORTIVA')).toBe('foto-esportiva')
  })
})
