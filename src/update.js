import { ObjectId } from 'mongodb'
import { transact, derivation } from 'derivable'
import mongo from './mongo'

const updateCache = (cache, domain, key) => {

  const rootLoader = cache.getLoader(domain.root)

  const findManyAndTraverse = (self, type, typeDef, other, otherDef, many = true) => {

    // console.log(`findManyAndTraverse, self:`, self, 'type', type, 'other', other, 'otherDef', otherDef)

    const loader = cache.getLoader(other)

    return mongo.then(db => db.collection(other).find({
      [otherDef.foreignKey]: ObjectId(self._id)
    }).toArray())
    .then(otherInstances => {

      // console.log('findManyAndTraverse, otherInstances', otherInstances.map(i => i._id))

      otherInstances.forEach(i => loader.prime(i._id, i))
      self[otherDef.as || other] = many ? otherInstances : (otherInstances.length > 0 ? otherInstances[0] : null)
      return otherInstances
    })
    .then(otherInstances => Promise.all(
      otherInstances.map(i => traverseToLoad(other, i._id))
    ))
  }

  function traverseToLoad(type, key) {
    const loader = cache.getLoader(type)
    console.log('traverseToLoad', type, key)
    return loader.load(key)
    .then(self => {
      const typeDef = domain.types[type]
      const { hasMany, hasOne } = typeDef

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

  return traverseToLoad(domain.root, key)
}

const derive = (cache, domain, key) => {

  function traverse(type, o, cb) {

    const traverseAssocication = (self, type, typeDef, other, otherDef, many = true) => {
      const others = self[otherDef.as || other]
      // console.log('findAndTraverse, others', others)
      if (many) {
        others.map(instance => traverse(other, instance, cb))
      } else {
        if (others) { // could be null
          return traverse(other, others, cb)
        }
      }
    }

    // console.log('traverse (cb)', type, o)
    if (!cb(type, o)) {
      console.log('aborting traversal, callback returned false')
    }

    const typeDef = domain.types[type]
    const { hasMany, hasOne } = typeDef
    // console.log('derive.traverse, o', o)
    Object.keys(hasMany || {})
    .map(otherTypeName => traverseAssocication(
      o, type, typeDef, otherTypeName, hasOne[otherTypeName]
    ))

    Object.keys(hasOne || {})
    .map(otherTypeName => traverseAssocication(
      o, type, typeDef, otherTypeName, hasOne[otherTypeName], false
    ))
  }

  const loader = cache.getLoader(domain.root)
  return loader.load(key)
  .then(self => {
    transact(() => {
      traverse(domain.root, self, (typeName, o) => {
        const type = domain.types[typeName]
        console.log('DERIVE?', type, o._id)
        Object.keys(type.derivedProps || []).map(propName => {
          if (!o[propName]) {
            const prop = type.derivedProps[propName]
            o[propName] = derivation(() => prop.f(o))
          }
        })
        return true
      })
    })

    // log derived values
    traverse(domain.root, self, (typeName, o) => {
      const type = domain.types[typeName]
      Object.keys(type.derivedProps || []).map(propName => {
        console.log(`o=${ o._id}, ${ propName }=${ o[propName].get() }`)
      })
      return true
    })
  })
}

export default (cache, domain, key) => updateCache(cache, domain, key)
.then(() => derive(cache, domain, key))
