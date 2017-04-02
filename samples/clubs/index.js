import repl from 'repl'
import { promisify } from 'repl-promised'
import * as R from 'ramda'
import { MongoClient, ObjectId } from 'mongodb'
import { Cache, update, resync, tailAndInvalidate, startRepl } from '../../src'
import domain from './clubs-domain'

const mongoUrl = process.env.MONGO_URL || `mongodb://localhost/u5-derive-dev`
const mongo = MongoClient.connect(mongoUrl)

// start
// following provides a REPL for testing. An actual server using u5-derive would
// not have this (necessarily).

mongo.then(db => {

  console.log('domain types: ' + R.keys(domain.types).join(', '))

  const cache = new Cache(mongo)

  // setup mongodb tailing
  const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
  const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME || 'u5-derive-dev'
  tailAndInvalidate(tailUrl, tailDatabaseName, cache)

  startRepl({
    prompt: 'clubs > ',
    mongo,
    cache,
    domain
  })

})
.catch(err => { console.log(err); throw err })
