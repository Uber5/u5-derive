import { ObjectId } from 'mongodb'
import mongo from './mongo'

const updateCache = (cache, domain, key) => {

  const rootLoader = cache.getLoader(domain.root)

  const findManyAndTraverse = (self, type, typeDef, other, otherDef) => {

    console.log(`findManyAndTraverse, self:`, self, 'type', type, 'other', other, 'otherDef', otherDef)

    const loader = cache.getLoader(other)

    return mongo.then(db => db.collection(other).find({
      [otherDef.foreignKey]: ObjectId(self._id)
    }).toArray())
    .then(otherInstances => {

      console.log('findManyAndTraverse, otherInstances', otherInstances.map(i => i._id))

      otherInstances.forEach(i => loader.prime(i._id, i))
      self[other] = otherInstances
      return otherInstances
    })
    .then(otherInstances => Promise.all(
      otherInstances.map(i => traverse(other, i._id))
    ))
  }

  function traverse(type, key) {
    const loader = cache.getLoader(type)
    console.log('traverse', type, key)
    return loader.load(key)
    .then(self => {
      const typeDef = domain.types[type]
      const { hasMany, hasOne } = typeDef

      console.log('traverse, self', self)
      if (self.__loaded) {
        console.log('Breaking recursion?', type, key)
        return Promise.resolve()
      }
      self.__loaded = true

      const hasManyPromises = Object.keys(hasMany || {})
      .map(otherTypeName => findManyAndTraverse(
        self, type, typeDef, otherTypeName, hasMany[otherTypeName]
      ))

      // TODO: almost the same as for 'hasMany' (only thing different is probably
      // how `self` should refer to the other(s)?)
      const hasOnePromises = Object.keys(hasOne || {})
      .map(otherTypeName => findManyAndTraverse(
        self, type, typeDef, otherTypeName, hasOne[otherTypeName]
      ))

      return Promise.all([ ...hasManyPromises, ...hasOnePromises ])
    })
  }

  return rootLoader.load(key)
  .then(root => {
    console.log('root loaded', root)
    return root
  })
  .then(root => traverse(domain.root, key))
}

export default (cache, domain, key) => new Promise((resolve, reject) => {

  // resolve('ok')

  return updateCache(cache, domain, key)
  .then(() => {
    console.log('should now derive (or done already?), then store derived props')
    throw new Error('oops')
  })
  .catch(err => {
    console.log('error in UPDATE', err)
    throw err
  })
})
