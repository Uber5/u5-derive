import { map, sum, times, prop } from 'ramda'
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

const randomWeight = () => Math.floor(Math.random() * 1000)

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
      weight: randomWeight()
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
          weight: randomWeight()
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

    it ('works for "findOneAndUpdate" when foreign key changes', async () => {

      // create another thing
      const otherThing = {
        name: `Another thing, ${new Date}`
      }
      await Things.insertOne(otherThing)

      // .. and give the first part the foreign key of the other thing
      await Parts.findOneAndUpdate(
        { _id: parts[0]._id },
        { $set: { thingId: otherThing._id }}
      )
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      const otherThingUpdated = await Things.findOne({ _id: otherThing._id })

      // as a result, the totalWeight of the "old thing" should be 
      // the sum of the second and third part
      expect(thingUpdated._D.totalWeight).toBe(parts[1].weight + parts[2].weight)

      // ... and the totalWeight of the "other thing" should be the
      // weight of the first part
      expect(otherThingUpdated._D.totalWeight).toBe(parts[0].weight)

    })

    it ('works for "findOneAndReplace"', async () => {
      await Parts.findOneAndReplace({ _id: parts[0]._id }, { weight: 0 })
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(thing._D.totalWeight - parts[0].weight)
    })

    for (let fn of [ 'deleteOne', 'findOneAndDelete' ]) {
      it(`works for ${fn}`, async () => {
        const weightWeAreLosing = parts[0].weight
        const currentTotalWeight = sum(map(p => p.weight, parts))
        await Parts[fn]({ _id: parts[0]._id }) // will try "deleteOne" etc
        await db.updateDomainNow()
        const thingUpdated = await Things.findOne({ _id: thing._id })
        expect(thingUpdated._D.totalWeight).toBe(currentTotalWeight - weightWeAreLosing)
      })
    }

    const deprecatedFns = [
      'findAndModify', 'findAndRemove', 'insert', 'remove', 'save', 'update'
    ]
    for (let fn of deprecatedFns) {
      it(`rejects ${fn} as deprecated`, () => {
        expect(() => Parts[fn]()).toThrow(/deprecated/)
      })
    }

    it('works for "deleteMany"', async () => {
      await Parts.deleteMany({
        _id: { $in: [ parts[0]._id, parts[1]._id ]}
      })
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(parts[2].weight)
    })

    it('"deleteMany" also works for a root instance', async () => {
      await Things.deleteMany({ _id: { $in: [ thing._id ] } })
      await db.updateDomainNow()
      const findResult = await Things.find({ _id: thing._id }).toArray()
      expect(findResult.length).toBe(0)
    })

    const notSupportedFns = [
      'bulkWrite',
      'initializeOrderedBulkOp',
      'initializeUnorderedBulkOp',
      'replaceOne',
      'updateOne'
    ]
    for (let fn of notSupportedFns) {
      it(`fails on ${fn}, currently not supported`, async () => {
        expect(() => Things[fn]()).toThrow(/not supported/)
      })
    }

    it('works for "insertMany"', async () => {
      const additionalParts = times(() => ({
        thingId: thing._id,
        weight: randomWeight()
      }), 5)
      const additionalWeight = sum(
        map(prop('weight'))(additionalParts)
      )
      await Parts.insertMany(additionalParts)
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(thing._D.totalWeight + additionalWeight)
    })

    it('works for "updateMany"', async () => {
      const partIds = map(prop('_id'), parts)
      await Parts.updateMany({
        _id: { $in: partIds }
      }, {
        $set: { weight: 0 }
      })
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      expect(thingUpdated._D.totalWeight).toBe(0)
    })

    it('works for "updateMany", when foreign keys change', async () => {
      const otherThing = {
        name: `Another thing (${new Date})`
      }
      await Things.insertOne(otherThing)
      await Parts.updateMany(
        {
          _id: { $in: [ parts[0]._id, parts[1]._id ]}
        },
        {
          $set: { thingId: otherThing._id }
        }
      )
      await db.updateDomainNow()
      const thingUpdated = await Things.findOne({ _id: thing._id })
      const otherThingUpdated = await Things.findOne({ _id: otherThing._id })
      expect(thingUpdated._D.totalWeight).toBe(parts[2].weight)
      expect(otherThingUpdated._D.totalWeight).toBe(parts[0].weight + parts[1].weight)
    })

  })
})