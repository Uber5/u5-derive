import SeenKeysByType from '../seen-keys-by-type'

describe('SeenKeysByType', () => {
  it('works', () => {
    const skbt = new SeenKeysByType()
    expect(skbt.seen('t1', '123')).toBe(false)
    skbt.add('t1', '123')
    skbt.add('t1', '124')
    expect(skbt.seen('t1', '123')).toBe(true)
    expect(skbt.seen('t1', '125')).toBe(false)
    expect(skbt.seen('t2', '125')).toBe(false)
    expect(skbt.seen('t1', '123')).toBe(true)
    expect(skbt.seen('t1', '124')).toBe(true)
  })
})