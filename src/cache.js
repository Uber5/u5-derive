import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'
import mongo from './mongo'

const debug = require('debug')('u5-derive')

mongo.then(db => debug('connected', db.databaseName))

const load = type => keys => mongo
.then(db => {
  return db
})
.then(db => db.collection(type).find({
  _id: {
    $in: keys.map(key => ObjectId(key))
  }
}).toArray())
.then(docs => {
  if (docs.length != keys.length) {
    throw new Error(`load failed, keys=${ keys }, docs.length=${ docs.length }.`
      + ' This probably means that (one of the) keys were not found in MongoDB.')
  }
  return docs
})

class Cache {
  constructor() {
    this.loaders = {}
  }
  hasLoader(type) {
    return this.loaders[type] != null
  }
  getLoader(type) {
    if (!this.loaders[type]) {
      this.loaders[type] = new DataLoader(load(type))
    }
    return this.loaders[type]
  }
}
export default Cache
