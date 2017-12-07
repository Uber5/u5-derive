import findRootKeys from '../find-root-keys'
import { Domain } from '../domain'
import { mongo } from './config'

describe('find root keys, given a document (type and instance) that supposedly were just updated or deleted', () => {

  describe('given a null / empty domain', () => {
    
    const domain = {
      root: 'non-existent-type',
      types: {}
    }

    it('gives us an empty array', async () => {
      const keys = await findRootKeys(
        domain, null /* db */, 'no-type', {}
      )
      expect(keys).toEqual(new Set())
    })

  })

  describe('given two levels "from the root"', () => {
    const domain: Domain = {
      root: 'roots',
      types: {
        roots: {
          hasMany: {
            level1s: {
              of: 'level1s',
              foreignKey: 'rootId'
            }
          }
        },
        level1s: {
          hasMany: {
            level2s: {
              of: 'level2s',
              foreignKey: 'level1Id'
            }
          }
        },
        level2s: {}
      }
    }
    it('determines the root key(s)', async () => {
      const db = await mongo
      const [ roots, level1s, level2s ] = [ 'roots', 'level1s', 'level2s' ].map(
        name => db.collection(name)
      )
      const root = {}
      await roots.insertOne(root)
      const level1 = { rootId: root._id }
      await level1s.insertOne(level1)
      const level2 = { level1Id: level1._id }
      await level2s.insertOne(level2)

      const keys = await findRootKeys(
        domain,
        db,
        'level2s',
        level2
      )
      expect(Array.from(keys.keys())).toEqual([ root._id ])
    })
  })

})