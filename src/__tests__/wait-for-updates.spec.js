import { mongoUrl, tailUrl, tailDatabaseName } from './config'

/**
 * Idea: we should be able to wait via a Promise until all expected updates
 * (to root instances of the domain) are finished.
 */

import { writeFileSync } from 'fs'
import { MongoClient } from 'mongodb'

const wrapCollectionObj = original => {
  const wrapper = {}
  for (let prop in original) {
    if (typeof(original[prop]) === 'function') {
      const fnName = prop
      wrapper[fnName] = function() {
        console.log('calling collection Fn', fnName)
        const result = original[fnName].apply(this, arguments)
        switch(fnName) {
        case 'insertOne':
          // add *something* (sync!) to remember we have to wait
          // add something (async!) to wait for the result of 'insertOne',
          // ... and afterwards, use the _id added to determine the roots we have
          // to wait for
          result.then(() => {
            // TODO: we should get the inserted _id from the result
            setTimeout(
              () => {
                console.log(`insertOne done, arg[0]._id=${arguments[0]._id}`)
              },
              1000
            )
          })
        break
        default:
          // do nothing
        }
        return result
      }
    } else {
      wrapper[prop] = original[prop]
    }
  }
  return wrapper
}

const wrapCollectionFn = db => function() {
  const coll = db.collection.apply(this, arguments)
  console.log('getting collection', arguments[0])
  return wrapCollectionObj(coll)
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

  wrapper.updateDomainNow = async () => {
    // throw new Error('oops')
    return new Promise(res => setTimeout(() => res(), 2000))
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

    // TODO: we want a bit more here: If we do not
    // say "make sure all domain updates are done", then
    // a debounce'd update should kick in.
    // if we *do* say we want them done, then we should trigger them
    // immediately and wait until they are finished.
    await db.updateDomainNow()
    const thingAgain = await things.findOne({ _id: thing._id })
    // now we expect derived properties in '_D' in 'thingAgain' to be updated
  })
})