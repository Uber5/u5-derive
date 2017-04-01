import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import mongo from '../mongo'
import domain from '../../samples/simple/domain'

const simplifiedInsert = (collection, doc) => mongo
  .then(db => db.collection(collection))
  .then(coll => coll.insert(doc))
  .then(r => r.ops[0])

describe('simple domain', () => {

  let cache, update

  beforeEach(() => mongo.then(db => {

    cache = new Cache()

    // setup mongodb tailing
    const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
    const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'
    tailAndInvalidate(tailUrl, tailDatabaseName, cache)

    update = key => _update(cache, domain, key)

  }))

  it('derives simple props', () => mongo
    .then(db => simplifiedInsert('journeys', {}))
    .then(journey => Promise.all([
      journey,
      mongo.then(db => simplifiedInsert('legs', { journeyId: journey._id }))
    ]))
    .then(([ journey, leg ]) => Promise.all([
      journey,
      leg,
      update(journey._id)
    ]))
    .then(([ journey, leg, updateResult ]) => {
      // console.log('journey, leg, updateResult', journey, leg, updateResult)
      return mongo.then(db => db.collection('journeys').findOne({ _id: journey._id }))
    })
    .then(journey => expect(journey._D.numLegs).toBe(1))
  )
})
