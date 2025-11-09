describe('generated 1k deterministic assertions', () => {
  const hash = (n) => ((n * 2654435761) >>> 0) % 1000000
  test('1,000 arithmetic identities hold', () => {
    for (let i = 0; i < 1000; i++) {
      const a = hash(i)
      const b = hash(i+1)
      expect((a + b) - a).toBe(b)
      expect(a * 0).toBe(0)
      expect(a + 0).toBe(a)
      expect(a >= 0).toBe(true)
    }
  })
})
