import repl from 'repl'
import { promisify } from 'repl-promised'
import * as R from 'ramda'
import { MongoClient, ObjectId } from 'mongodb'
import { update, resync } from './update'

export default config => config.mongo.then(db => {

  const { cache, domain, mongo } = config

  const replServer = repl.start({
    prompt: config.prompt || "u5-derive > ",
  });

  replServer.context._db = db
  replServer.context.ObjectId = ObjectId
  replServer.context.R = R

  replServer.context.resync = () => resync(cache, domain)
    .then(() => console.log('resync done'))
  replServer.context.update = key => update(cache, domain, key)
    .then(() => console.log('update done'))

  R.keys(domain.types).map(type => {
    replServer.context[type] = {
      all: () => db.collection(type).find({}).toArray(),
      find: query => db.collection(type).find(query).toArray(),
      insert: doc => db.collection(type).insert(doc),
      update: (_id, update) => db.collection(type)
        .findOneAndUpdate({ _id: new ObjectId(_id) }, update, { returnOriginal: false })
    }
  })

  promisify(replServer)
})
