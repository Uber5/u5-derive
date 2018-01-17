import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'

const debug = require('debug')('u5-derive:cache')

const load = (mongo, type) => keys => mongo
.then(db => db.collection(type))
.then(coll => Promise.all(
  keys.map(key => coll.findOne({ _id: (key) }))
))
.then(docs => {
  debug('cache, found docs for keys', type, keys, docs)
  if (docs.length != keys.length) {
    throw new Error(`load failed for '${ type }', keys=${ keys }, docs.length=${ docs.length }.`
      + ' This probably means that (one of the) keys were not found in MongoDB.')
  }
  return docs
})

class Cache {
  constructor(mongo) {
    this.loaders = {}
    this.mongo = mongo
  }
  hasLoader(type) {
    return this.loaders[type] != null
  }
  getLoader(type) {
    if (!this.loaders[type]) {
      debug('new Dataloader for type', type)
      this.loaders[type] = new DataLoader(
        load(this.mongo, type),
        {
          cacheKeyFn: key => {
            debug('cacheKeyFn, key', type, key)
            return key.toString()
          }
        }
      )
    }
    return this.loaders[type]
  }
  clear() {
    this.loaders = {}
  }
}
export default Cache
