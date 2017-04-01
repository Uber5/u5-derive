import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import domain from '../../samples/simple/domain'

import { MongoClient } from 'mongodb'

const mongoUrl = process.env.MONGO_URL_TEST || `mongodb://localhost/u5-derive-test`

const mongo = MongoClient.connect(mongoUrl)

const simplifiedInsert = (collection, doc) => mongo
  .then(db => db.collection(collection))
  .then(coll => coll.insert(doc))
  .then(r => r.ops[0])

const journeyWithThreeLegs = () => simplifiedInsert('journeys', {})
  .then(journey => Promise.all([
    journey,
    simplifiedInsert('legs', { journeyId: journey._id, distance: Math.floor(Math.random() * 10) }),
  ]))
  .then(([ journey, leg1 ]) => Promise.all([
    journey,
    leg1,
    simplifiedInsert('legs', {
      journeyId: journey._id,
      previousLeg: leg1._id,
      distance: Math.floor(Math.random() * 10)
    }),
  ]))
  .then(([ journey, leg1, leg2 ]) => Promise.all([
    journey,
    leg1,
    leg2,
    simplifiedInsert('legs', {
      journeyId: journey._id,
      previousLeg: leg2._id,
      distance: Math.floor(Math.random() * 10)
    }),
  ]))
  .then(([ journey, leg1, leg2, leg3 ]) => journey)
  .then(journey => { console.log('journey', journey); return journey })

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

  it('derives within a linked list', () => journeyWithThreeLegs()
    .then(journey => update(journey._id).then(() => journey))
    .then(journey => mongo.then(db => db.collection('journeys').findOne({ _id: journey._id })))
    .then(journey => { console.log('journey', journey); return journey })
    .then(journey => expect(journey._D.numLegs).toBe(3))
  )

})
