import { describe, it, expect } from 'vitest'
import { extractJson } from '../utils'

describe('extractJson', () => {
  it('extracts JSON from markdown code block', () => {
    const input = '```json\n[{"index": 0, "score": 8}]\n```'
    expect(extractJson(input)).toBe('[{"index": 0, "score": 8}]')
  })

  it('extracts JSON array without code block', () => {
    const input = 'Here is the result: [{"a": 1}, {"b": 2}]'
    expect(extractJson(input)).toBe('[{"a": 1}, {"b": 2}]')
  })

  it('extracts JSON object without code block', () => {
    const input = 'Result: {"key": "value", "count": 3}'
    expect(extractJson(input)).toBe('{"key": "value", "count": 3}')
  })

  it('returns null for no JSON', () => {
    expect(extractJson('No JSON here')).toBeNull()
  })

  it('handles code block without json tag', () => {
    const input = '```\n{"key": "value"}\n```'
    expect(extractJson(input)).toBe('{"key": "value"}')
  })

  it('prefers code block over bare JSON', () => {
    const input = 'Some text [1,2] ```json\n[3,4]\n``` more text'
    expect(extractJson(input)).toBe('[3,4]')
  })
})
