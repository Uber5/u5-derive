import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'
import * as R from 'ramda'

const debug = require('debug')('u5-derive')

const load = (mongo, type) => keys => mongo
.then(db => db.collection(type).find({
  _id: {
    $in: R.uniq(keys).map(key => ObjectId(key))
  }
}).toArray())
.then(docs => {
  if (docs.length != R.uniq(keys).length) {
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
      this.loaders[type] = new DataLoader(load(this.mongo, type))
    }
    return this.loaders[type]
  }
}
export default Cache
