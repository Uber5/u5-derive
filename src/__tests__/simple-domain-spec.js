import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import mongo from '../mongo'
import domain from '../../samples/simple/domain'

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

  it('does stuff', () => Promise
    .resolve(3)
    .then(r => expect(r).toBe(3))
  )

  it('derives simple props', () => mongo
    .then(db => db.collection('journeys').insert({}))
    .then(insertResult => insertResult.ops[0])
    .then(journey => Promise.all([
      journey,
      mongo.then(db => db.collection('legs').insert({ journeyId: journey._id }))
    ]))
    .then(([ journey, insertResult ]) => Promise.all([
      journey,
      insertResult.ops[0],
      update(journey._id)
    ]))
    .then(([ journey, leg, updateResult ]) => {
      // console.log('journey, leg, updateResult', journey, leg, updateResult)
      return mongo.then(db => db.collection('journeys').findOne({ _id: journey._id }))
    })
    .then(journey => expect(journey._D.numLegs).toBe(1))
  )
})
