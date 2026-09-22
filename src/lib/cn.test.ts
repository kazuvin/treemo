import { clsx, twMerge } from 'cn'
import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('clsx', () => {
  it('should handle string inputs', () => {
    expect(clsx('foo', 'bar')).toBe('foo bar')
  })

  it('should include number inputs', () => {
    expect(clsx('foo', 123, 'bar')).toBe('foo 123 bar')
  })

  it('should filter out falsy values', () => {
    expect(clsx('foo', false, null, undefined, '', 'bar')).toBe('foo bar')
  })

  it('should handle object inputs', () => {
    expect(clsx({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('should handle array inputs', () => {
    expect(clsx(['foo', 'bar'])).toBe('foo bar')
    expect(clsx(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  it('should handle mixed inputs', () => {
    expect(clsx('foo', { bar: true, baz: false }, ['qux', { quux: true }])).toBe('foo bar qux quux')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(clsx('btn', isActive && 'active', isDisabled && 'disabled')).toBe('btn active')
  })

  it('should return empty string for no inputs', () => {
    expect(clsx()).toBe('')
  })

  it('should skip zero as a falsy value', () => {
    expect(clsx('foo', 0, 'bar')).toBe('foo bar')
  })
})

describe('twMerge', () => {
  it('should merge basic classes', () => {
    const result = twMerge('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('should keep non-conflicting classes', () => {
    const result = twMerge('px-2 py-1', 'px-4')
    expect(result).toBe('py-1 px-4')
  })

  it('should handle display classes', () => {
    const result = twMerge('block', 'flex', 'inline-block')
    expect(result).toBe('inline-block')
  })

  it('should handle background colors', () => {
    const result = twMerge('bg-red-500', 'bg-blue-500')
    expect(result).toBe('bg-blue-500')
  })

  it('should handle text colors', () => {
    const result = twMerge('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('should handle border radius', () => {
    const result = twMerge('rounded', 'rounded-lg')
    expect(result).toBe('rounded-lg')
  })

  it('should handle multiple conflicting properties', () => {
    const result = twMerge('p-2 bg-red-500 text-white', 'p-4 bg-blue-500')
    expect(result).toBe('text-white p-4 bg-blue-500')
  })

  it('should return empty string for no input', () => {
    expect(twMerge()).toBe('')
  })
})

describe('cn', () => {
  it('should combine clsx and twMerge', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toBe('py-1 px-4')
  })

  it('should handle conditional classes with conflicts', () => {
    const isLarge = true
    const result = cn('px-2', isLarge && 'px-4')
    expect(result).toBe('px-4')
  })

  it('should handle object syntax with conflicts', () => {
    const result = cn('px-2', { 'px-4': true, 'py-2': true })
    expect(result).toBe('px-4 py-2')
  })

  it('should handle complex real-world usage', () => {
    const baseClasses = 'px-2 py-1 bg-blue-500 text-white rounded'
    const conditionalClasses = {
      'px-4': true,
      'bg-red-500': false,
      'rounded-lg': true,
    }
    const overrideClasses = 'py-2'

    const result = cn(baseClasses, conditionalClasses, overrideClasses)
    expect(result).toContain('px-4')
    expect(result).toContain('py-2')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('text-white')
    expect(result).toContain('rounded-lg')
    expect(result).not.toContain('px-2')
    expect(result).not.toContain('py-1')
    expect(result).not.toContain('rounded ')
  })

  it('should handle shadcn/ui component pattern', () => {
    const buttonVariants = {
      base: 'inline-flex items-center justify-center rounded-md text-sm font-medium',
      variants: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      sizes: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    }

    const result = cn(
      buttonVariants.base,
      buttonVariants.variants.default,
      buttonVariants.sizes.lg,
      'px-6', // Custom override
    )

    expect(result).toContain('h-11')
    expect(result).toContain('rounded-md')
    expect(result).toContain('px-6') // Should override px-8
    expect(result).not.toContain('px-8')
  })

  it('should return empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('should handle arrays', () => {
    const result = cn(['px-2', 'py-1'], ['px-4'])
    expect(result).toBe('py-1 px-4')
  })

  describe('off-ladder font sizes', () => {
    const sizes = ['2xs', 'mark']

    it.each(sizes)('should keep text-%s when a text colour follows', (size) => {
      const result = cn(`text-${size}`, 'text-foreground')
      expect(result).toContain(`text-${size}`)
      expect(result).toContain('text-foreground')
    })

    it('should treat an off-ladder size as replacing a standard one', () => {
      expect(cn('text-base', 'text-2xs')).toBe('text-2xs')
    })

    it('should treat a standard size as replacing an off-ladder one', () => {
      expect(cn('text-2xs', 'text-base')).toBe('text-base')
    })

    it('should still collapse conflicting text colours', () => {
      expect(cn('text-foreground', 'text-muted-foreground')).toBe('text-muted-foreground')
    })
  })
})
