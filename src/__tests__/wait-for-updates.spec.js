import { map, sum, times } from 'ramda'
import { mongoUrl } from './config'
import domainMongo from '../domain-mongo'

/**
 * Idea: we should be able to wait via a Promise until all expected updates
 * (to root instances of the domain) are finished.
 */

const domain: Domain = {
  root: 'things',
  types: {
    things: {
      hasMany: {
        parts: {
          of: 'parts',
          foreignKey: 'thingId'
        }
      },
      hasOne: {},
      derivedProps: {
        totalWeight: {
          f: self => self.parts.get().map(part => part.weight).reduce((sum, v) => sum + v, 0)
        }
      }
    },
    parts: {
    }
  }
}

describe('domainMongo', () => {

  it('updateDomainNow works in a simple case', async () => {
    const db = await domainMongo({
      domain,
      mongoUrl
    })
    const things = db.collection('things')
    const parts = db.collection('parts')

    const thing = { name: `New thing at ${new Date}` }
    await things.insertOne(thing)

    const part = {
      name: `This is a part of thing ${thing._id}`,
      thingId: thing._id,
      weight: Math.floor(Math.random() * 1000)
    }
    await parts.insertOne(part)

    // TODO: we want a bit more here: If we do not
    // say "make sure all domain updates are done", then
    // a debounce'd update should kick in.
    // if we *do* say we want them done, then we should trigger them
    // immediately and wait until they are finished.
    await db.updateDomainNow()
    const thingAgain = await things.findOne({ _id: thing._id })

    // now we expect derived properties in '_D' in 'thingAgain' to be updated
    expect(thingAgain._D.totalWeight).toBe(part.weight)
  })

  it('caches collection instances', async () => {
    const db = await domainMongo({
      domain,
      mongoUrl
    })
    const things = db.collection('things')
    const thingsAgain = db.collection('things')
    expect(things).toEqual(thingsAgain)
  })

  it('allows me to use the "collections" function', async () => {
    const db = await domainMongo({
      domain,
      mongoUrl
    })

    const things = db.collection('things')
    await things.insertOne({ bla: 42 })

    const hasCollection = async (name, db) => {
      return (await db.collections())
        .filter(c => c.collectionName === name) > 0
    }
    
    expect(
      hasCollection('things', db)
    ).toBeTruthy()
  })

  describe('given a simple domain and db state', () => {

    let db, thing, parts, Things, Parts

    beforeEach(async () => {
      db = await domainMongo({ domain, mongoUrl })
      Things = db.collection('things')
      Parts = db.collection('parts')
      thing = { desc: 'simple domain and db state tests, ' + new Date() }
      await Things.insertOne(thing)
      parts = await Promise.all(times(
        () => Parts.insertOne({
          thingId: thing._id,
          weight: Math.floor(Math.random() * 100)
        }),
        3
      ))
      await db.updateDomainNow()

      // refresh documents from db
      thing = await Things.findOne({ _id: thing._id })
      parts = await Parts.find({ thingId: thing._id }).toArray()
    })

    it('works for "findOneAndUpdate', async () => {
      await Parts.findOneAndUpdate({ _id: parts[0]._id }, { $inc: { weight: 1 }})
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(thing._D.totalWeight + 1)
    })

    it('works for "deleteOne', async () => {
      const weightWeAreLosing = parts[0].weight
      const currentTotalWeight = sum(map(p => p.weight, parts))
      await Parts.deleteOne({ _id: parts[0]._id })
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(currentTotalWeight - weightWeAreLosing)
    })

  })
})