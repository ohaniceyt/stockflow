import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it.each([
    { includeB: false, expected: 'a c' },
    { includeB: true, expected: 'a b c' },
  ])('handles conditional classes (includeB=$includeB)', ({ includeB, expected }) => {
    expect(cn('a', includeB && 'b', 'c')).toBe(expected)
  })

  it('resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
