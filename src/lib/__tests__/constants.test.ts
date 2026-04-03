import { describe, it, expect } from 'vitest'
import { SOURCE_COLORS, SOURCE_META } from '../constants'

describe('constants', () => {
  it('SOURCE_COLORS has entries for all SOURCE_META keys', () => {
    for (const key of Object.keys(SOURCE_META)) {
      expect(SOURCE_COLORS[key]).toBeDefined()
    }
  })

  it('SOURCE_META entries have icon and name', () => {
    for (const [key, meta] of Object.entries(SOURCE_META)) {
      expect(meta.icon).toBeTruthy()
      expect(meta.name).toBeTruthy()
    }
  })
})
