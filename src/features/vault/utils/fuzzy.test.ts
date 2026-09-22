import { fuzzyFilter, fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches characters in order', () => {
    expect(fuzzyScore('mt', 'meeting')).not.toBeNull()
    expect(fuzzyScore('tm', 'meeting')).toBeNull()
  })

  it('ignores case and spaces', () => {
    expect(fuzzyScore('Me ET', 'meeting')).not.toBeNull()
  })
})

describe('fuzzyFilter', () => {
  it('ranks consecutive and word-start matches higher', () => {
    const items = ['daily/2026-09-01', 'notes/plan', 'planning']
    expect(fuzzyFilter('plan', items, (x) => x)).toEqual(['planning', 'notes/plan'])
  })
})
