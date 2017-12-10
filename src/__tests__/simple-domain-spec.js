import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import domain from '../../samples/simple/domain'
import { mongo } from './config'

export const simplifiedInsert = (collection, doc) => mongo
  .then(db => db.collection(collection))
  .then(coll => coll.insert(doc))
  .then(r => r.ops[0])

export const findById = (collection, id) => mongo
  .then(db => db.collection(collection).findOne({ _id: id }))

const journeyWithThreeLegs = () => simplifiedInsert('journeys', {})
  .then(journey => Promise.all([
    journey,
    simplifiedInsert('legs', { journeyId: journey._id, distance: Math.floor(Math.random() * 10) }),
  ]))
  .then(([ journey, leg3 ]) => Promise.all([
    journey,
    leg3,
    simplifiedInsert('legs', {
      journeyId: journey._id,
      nextLegId: leg3._id,
      distance: Math.floor(Math.random() * 10)
    }),
  ]))
  .then(([ journey, leg3, leg2 ]) => Promise.all([
    journey,
    leg3,
    leg2,
    simplifiedInsert('legs', {
      journeyId: journey._id,
      nextLegId: leg2._id,
      distance: Math.floor(Math.random() * 10)
    }),
  ]))
  .then(([ journey, leg3, leg2, leg1 ]) => journey)
  // .then(journey => { console.log('journey', journey); return journey })

describe('simple domain', () => {

  let cache, update

  beforeEach(() => mongo.then(db => {

    cache = new Cache(mongo)

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

  describe('linked list', () => {
    it('derives within a linked list', () => journeyWithThreeLegs()

      // update (runs declarative logic)
      .then(journey => update(journey._id).then(() => journey))

      // refresh (findOne again) the journey
      .then(journey => mongo.then(db => db.collection('journeys').findOne({ _id: journey._id })))
      // .then(journey => { console.log('journey', journey); return journey })
      // .then(journey => expect(journey._D.numLegs).toBe(3))

      // load legs
      .then(journey => Promise.all([
        journey,
        mongo.then(db => db.collection('legs').find({ journeyId: journey._id }).toArray()),
        mongo.then(db => db.collection('legs').findOne({ _id: journey._D.firstLegId })),
        mongo.then(db => db.collection('legs').findOne({ _id: journey._D.lastLegId }))
      ]))
      .then(([ journey, legs, firstLeg, lastLeg ]) => {
        expect(journey._D.numLegs).toBe(3)
        expect(legs.reduce((sum, l) => sum + l.distance, 0)).toBe(lastLeg._D.distanceSoFar)
        expect(firstLeg.distance === firstLeg._D.distanceSoFar)
      })
    )
  })

})
