import * as R from 'ramda'
import { Cache, update as _update, resync, tailAndInvalidate } from '..'
import domain from '../../samples/clubs/clubs-domain'
import { mongo as client } from './config'

const simplifiedInsert = (collection, doc) => client
  .then(client => client.db().collection(collection).insert(doc))
  .then(r => r.ops[0])

const setupClubAndMembers = update => simplifiedInsert('clubs', {})
  .then(club => Promise.all([
    club._id,
    Promise.all(R.times(i => simplifiedInsert('members', { clubIdOrdinaryMember: club._id }), 3)),
    Promise.all(R.times(i => simplifiedInsert('members', { clubIdVipMember: club._id }), 5)),
  ]))
  .then(([ clubId ]) => Promise.all([ clubId, update(clubId) ]))
  .then(([ clubId ]) => Promise.all([
    client.then(client => client.db().collection('clubs').findOne({ _id: clubId })),
    client.then(client => client.db().collection('members').find({
      $or: [
        { clubIdOrdinaryMember: clubId },
        { clubIdVipMember: clubId }
      ]
    }).toArray())
  ]))

describe('multiple associations between two types', () => {

  let update

  beforeEach(() => client.then(client => client.db()).then(db => {

    const cache = new Cache(db)

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
