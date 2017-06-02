import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import domain from '../../samples/clubs/clubs-domain'

import { MongoClient } from 'mongodb'
import * as R from 'ramda'

const mongoUrl = process.env.MONGO_URL_TEST || `mongodb://localhost/u5-derive-test`

const mongo = MongoClient.connect(mongoUrl)

const simplifiedInsert = (collection, doc) => mongo
  .then(db => db.collection(collection))
  .then(coll => coll.insert(doc))
  .then(r => r.ops[0])

const setupClubAndMembers = update => simplifiedInsert('clubs', {})
  .then(club => Promise.all([
    club._id,
    Promise.all(R.times(i => simplifiedInsert('members', { clubIdOrdinaryMember: club._id }), 3)),
    Promise.all(R.times(i => simplifiedInsert('members', { clubIdOrdinaryMember: club._id }), 5)),
  ]))
  .then(([ clubId ]) => Promise.all([ clubId, update(clubId) ]))
  .then(([ clubId ]) => Promise.all([
    mongo.then(db => db.collection('clubs').findOne({ _id: clubId })),
    mongo.then(db => db.collection('members').find({
      $or: [
        { clubIdOrdinaryMember: clubId },
        { clubIdVipMember: clubId }
      ]
    }).toArray())
  ]))

describe('multiple associations between two types', () => {

  let update

  beforeEach(() => mongo.then(db => {

    const cache = new Cache(mongo)

    // setup mongodb tailing
    const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
    const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'
    tailAndInvalidate(tailUrl, tailDatabaseName, cache)

    update = key => _update(cache, domain, key)

  }))

  it('works', () => setupClubAndMembers(update)
    .then(([club, members]) => expect(club._D.numMembers).toBe(members.length))
  )
})
