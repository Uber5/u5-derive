import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'
import mongo from './mongo'

mongo.then(db => console.log('connected', db.databaseName))

const load = type => keys => mongo
.then(db => {
  console.log('should load', type, keys, keys.map(key => ObjectId(key)))
  return db
})
.then(db => db.collection(type).find({
  _id: {
    $in: keys.map(key => ObjectId(key))
  }
}).toArray())
.then(docs => {
  console.log('docs found', type, keys, docs)
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
  getLoader(type) {
    if (!this.loaders[type]) {
      this.loaders[type] = new DataLoader(load(type))
    }
    return this.loaders[type]
  }
}
export default Cache
