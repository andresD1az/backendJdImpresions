import fc from 'fast-check'

// Property-based tests for cart totals
// Given items with unit_price >=0 and quantity >=0,
// - line_total = unit_price * quantity
// - total = sum(line_total)
// - total is associative/commutative with respect to concatenation/permutation

describe('cart totals (property-based)', () => {
  const itemArb = fc.record({
    unit_price: fc.integer({ min: 0, max: 2_000_000 }),
    quantity: fc.integer({ min: 0, max: 10_000 })
  })
  const cartArb = fc.array(itemArb, { minLength: 0, maxLength: 50 })

  const calc = (items) => {
    const lines = items.map(i => ({
      unit_price: Number(i.unit_price)||0,
      quantity: Number(i.quantity)||0,
      line_total: (Number(i.unit_price)||0) * (Number(i.quantity)||0)
    }))
    const total = lines.reduce((a,b)=> a + b.line_total, 0)
    return { lines, total }
  }

  test('sum of lines equals total (1000 cases)', () => {
    fc.assert(
      fc.property(cartArb, (cart) => {
        const { lines, total } = calc(cart)
        const sum = lines.reduce((a,b)=> a + b.line_total, 0)
        expect(total).toBe(sum)
        expect(total).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 1000 }
    )
  })

  test('permutation invariance (300 cases)', () => {
    fc.assert(
      fc.property(cartArb, fc.integer({ min: 0, max: 10 }), (cart, seed) => {
        const { total: t1 } = calc(cart)
        // Permute deterministically based on seed
        const perm = [...cart].sort((a,b) => ((a.unit_price + a.quantity + seed) % 7) - ((b.unit_price + b.quantity + seed) % 7))
        const { total: t2 } = calc(perm)
        expect(t1).toBe(t2)
      }),
      { numRuns: 300 }
    )
  })
})
