import { mongoUrl, tailUrl, tailDatabaseName } from './config'

/**
 * Idea: we should be able to wait via a Promise until all expected updates
 * (to root instances of the domain) are finished.
 */

import { MongoClient } from 'mongodb'

const wrapCollectionFn = db => function() {
  const coll = db.collection.apply(this, arguments)
  console.log('getting collection', arguments[0])
  return coll
}

const domainMongo = async ({ domain, mongoUrl, tailUrl, tailDatabaseName }) => {
  const wrappedDb = await MongoClient.connect(mongoUrl)

  // we must wrap the Collection class 
  // ... and then record all root ids that we need to run an update on, for
  // each function that changes a type we know in the domain

  const wrapper = {}
  for (let prop in wrappedDb) {
    if (typeof(wrappedDb[prop]) === 'function') {
      switch(prop) {
        case 'collection':
          wrapper.collection = wrapCollectionFn(wrappedDb)
          break
        default:
          wrapper[prop] = function() {
            console.log('calling', prop)
            return wrappedDb[prop].apply(this, arguments)
          }
      }
    } else {
      wrapper[prop] = wrappedDb[prop]
    }
  }

  wrapper.domainUpdatesDone = () => {
    throw new Error('oops')
  }

  return wrapper
}

const hasCollection = async (name, db) => {
  return (await db.collections())
    .filter(c => c.collectionName === 'things') > 0
}

describe('Waiting for updates', () => {
  it('works', async () => {
    const db = await domainMongo({
      domain: undefined,
      mongoUrl,
      tailUrl,
      tailDatabaseName
    })
    const things = db.collection('things')
    const parts = db.collection('parts')
    const thing = { name: `New thing at ${new Date}` }
    await things.insertOne(thing)

    // just double check we call still use the 'collections' function
    // (which should *not* be wrapped)
    expect(
      hasCollection('things', db)
    ).toBeTruthy()

    console.log('thing', thing)
    const part = {
      name: `This is a part of thing ${thing._id}`,
      thingId: thing._id
    }
    await parts.insertOne(part)
    console.log('part', part)
    await db.domainUpdatesDone()
    const thingAgain = await things.findOne({ _id: thing._id })
    // now we expect derived properties in '_D' in 'thingAgain' to be updated
  })
})