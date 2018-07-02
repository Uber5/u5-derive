import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'

const debug = require('debug')('u5-derive:cache')

const load = (db, type) => keys => Promise.resolve(db.collection(type))
.then(coll => coll.find({ _id: { $in: keys } }).toArray())
.then(docs => {
  const map = {}
  docs.forEach(doc => map[doc._id.toString()] = doc)
  return keys.map(key => map[key.toString()])
})

class Cache {
  constructor(db) {
    this.loaders = {}
    this.db = db
  }
  hasLoader(type) {
    return this.loaders[type] != null
  }
  getLoader(type) {
    if (!this.loaders[type]) {
      debug('new Dataloader for type', type)
      this.loaders[type] = new DataLoader(
        load(this.db, type),
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
