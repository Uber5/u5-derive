import { ObjectId } from 'mongodb'
import mongo from './mongo'

const updateCache = (cache, domain, key) => {

  const rootLoader = cache.getLoader(domain.root)

  const findManyAndTraverse = (self, type, typeDef, other, otherDef, many = true) => {

    console.log(`findManyAndTraverse, self:`, self, 'type', type, 'other', other, 'otherDef', otherDef)

    const loader = cache.getLoader(other)

    return mongo.then(db => db.collection(other).find({
      [otherDef.foreignKey]: ObjectId(self._id)
    }).toArray())
    .then(otherInstances => {

      console.log('findManyAndTraverse, otherInstances', otherInstances.map(i => i._id))

      otherInstances.forEach(i => loader.prime(i._id, i))
      self[otherDef.as || other] = many ? otherInstances : (otherInstances.length > 0 ? otherInstances[0] : null)
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
        self, type, typeDef, otherTypeName, hasOne[otherTypeName], false /* not hasMany... */
      ))

      return Promise.all([ ...hasManyPromises, ...hasOnePromises ])
    })
  }

  return traverse(domain.root, key)
}

const derive = (cache, domain, key) => {

  function traverse(type, key) {
    const loader = cache.getLoader(type)
    return loader.load(key)
    .then(self => {
      const typeDef = domain.types[type]
      const { hasMany, hasOne } = typeDef
      console.log('derive.traverse, self', self)
      // ...
    })
  }

  return traverse(domain.root, key)
}

export default (cache, domain, key) => updateCache(cache, domain, key)
.then(() => derive(cache, domain, key))
