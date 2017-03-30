import repl from 'repl'
import { promisify } from 'repl-promised'
import * as R from 'ramda'

import { ObjectId } from 'mongodb'

import mongo from '../../src/mongo'
import { Cache, resync, tailAndInvalidate } from '../../src'

const domain = {
  root: 'journeys',
  types: {
    journeys: {
      hasMany: {
        legs: {
          as: 'details',
          foreignKey: 'journeyId'
        },
        journeys: { // TODO: what if we have multiple 'hasMany' to the same other type?
          as: 'shouldDoNext',
          foreinKey: 'shouldDoAfter'
        }
      },
      derivedProps: {
        numLegs: {
          f: self => self.details.get().length
        }
      }
    },
    legs: {
    }
  }
}

// start
// following provides a REPL for testing. An actual server using u5-derive would
// not have this (necessarily).
mongo.then(db => {
  console.log('type "foo" to see stuff...')

  const replServer = repl.start({
    prompt: "simple > ",
  });

  const cache = new Cache()

  replServer.context.foo = "bar";
  replServer.context._db = db
  replServer.context.ObjectId = ObjectId

  // setup mongodb tailing
  const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
  const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME || 'u5-derive-dev'
  tailAndInvalidate(tailUrl, tailDatabaseName, cache)

  replServer.context.resync = () => resync(cache, domain)
    .then(() => console.log('resync done'))

  R.keys(domain.types).map(type => {
    console.log('type', type)
    replServer.context[type] = {
      all: () => db.collection(type).find({}).toArray(),
      insert: doc => db.collection(type).insert(doc),
      update: (_id, update) => db.collection(type)
        .findOneAndUpdate({ _id: new ObjectId(_id) }, update, { returnOriginal: false })
    }
  })

  promisify(replServer)

})
.catch(err => { console.log(err); throw err })
