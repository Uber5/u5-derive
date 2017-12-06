import findRootKeys from '../find-root-keys'

describe('find root keys, given a document (type and instance) that supposedly were just updated or deleted', () => {

  describe('given a null / empty domain', () => {
    
    const domain = {
      root: 'non-existent-type',
      types: {}
    }

    it('gives us an empty array', async () => {
      const keys = await findRootKeys(domain, 'no-type', {})
      expect(keys).toEqual(new Set())
    })

  })

})