import { ObjectId } from 'mongodb'
import { transact, derivation } from 'derivable'
import * as R from 'ramda'

const debug = require('debug')('u5-derive')

const derivedPropsKey = process.env.DERIVED_PROPS_KEY || '_D'

const updateCache = (cache, domain, key, counter) => {

  debug(`updateCache, ${ key }, counter=${ counter }`)

  const findAndTraverse = (self, type, typeDef, other, otherDef, many = true) => {

    // console.log(`findAndTraverse, self:`, self, 'type', type, 'other', other, 'otherDef', otherDef)

    const loader = cache.getLoader(other)

    return cache.mongo.then(db => db.collection(other).find({
      [otherDef.foreignKey]: ObjectId(self._id)
    }).toArray())
    .then(otherInstances => {

      // console.log('findAndTraverse, otherInstances', otherInstances.map(i => i._id))

      otherInstances.forEach(i => loader.clear(i._id).prime(i._id, i))
      debug('findAndTraverse, about to assign', otherDef.as || other, self._id)
      self[otherDef.as || other] = many
        ? derivation(() => otherInstances)
        : derivation(() => otherInstances.length > 0 ? otherInstances[0] : null)
      return otherInstances
    })
    .then(otherInstances => Promise.all(
      otherInstances.map(i => traverseToLoad(other, i._id))
    ))
  }

  function traverseToLoad(type, key) {
    const loader = cache.getLoader(type)
    debug('traverseToLoad', type, key)
    return loader.load(key)
    .then(self => {
      const typeDef = domain.types[type]
      const { hasMany, hasOne } = typeDef

      if (self.__version >= counter) {
        // concurrent load may result in newer version, should be idempotent
        // nevertheless
        console.log('Breaking recursion', type, key)
        return Promise.resolve()
      }
      self.__version = counter

      const hasManyPromises = Object.keys(hasMany || {})
      .map(otherTypeName => findAndTraverse(
        self, type, typeDef, otherTypeName, hasMany[otherTypeName]
      ))

      // TODO: almost the same as for 'hasMany' (only thing different is probably
      // how `self` should refer to the other(s)?)
      const hasOnePromises = Object.keys(hasOne || {})
      .map(otherTypeName => findAndTraverse(
        self, type, typeDef, otherTypeName, hasOne[otherTypeName], false /* not hasMany... */
      ))

      return Promise.all([ ...hasManyPromises, ...hasOnePromises ])
    })
  }

  return traverseToLoad(domain.root, key)
}

const derive = (cache, domain, key) => {

  function traverse(type, o, cb) {

    const traverseAssociation = (self, type, typeDef, other, otherDef, many = true) => {
      const others = self[otherDef.as || other].get()
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
      debug('aborting traversal, callback returned false')
    }

    const typeDef = domain.types[type]
    const { hasMany, hasOne } = typeDef
    // console.log('derive.traverse, o', o)
    Object.keys(hasMany || {})
    .map(otherTypeName => traverseAssociation(
      o, type, typeDef, otherTypeName, hasMany[otherTypeName]
    ))

    Object.keys(hasOne || {})
    .map(otherTypeName => traverseAssociation(
      o, type, typeDef, otherTypeName, hasOne[otherTypeName], false
    ))
  }

  const loader = cache.getLoader(domain.root)
  return loader.load(key)
  .then(self => {
    transact(() => {
      traverse(domain.root, self, (typeName, o) => {
        const type = domain.types[typeName]
        // console.log('DERIVE?', type, o._id)
        Object.keys(type.derivedProps || []).map(propName => {
          const prop = type.derivedProps[propName]
          o[propName] = derivation(() => prop.f(o))
        })
        return true
      })
    })

    // store / update derived props
    const updates = []
    traverse(domain.root, self, (typeName, o) => {
      const type = domain.types[typeName]
      const derivedProps = {}
      Object.keys(type.derivedProps || []).map(propName => {
        // console.log(`o=${ o._id }, ${ propName }=${ o[propName].get() }`)
        derivedProps[propName] = o[propName].get()
      })
      // console.log(`derivedProps(old)=`, o[derivedPropsKey], derivedProps)
      if (!o[derivedPropsKey] || !R.equals(o[derivedPropsKey], derivedProps)) {
        debug(`must update ${ typeName } ${ o._id }`)
        updates.push(cache.mongo.then(db => db.collection(typeName).findOneAndUpdate({
          _id: ObjectId(o._id)
        }, {
          $set: { [derivedPropsKey]: derivedProps }
        })))
      }
      return true
    })
    return Promise.all(updates)

  })
}

let counter = 0
export const update = (cache, domain, key) => updateCache(cache, domain, key, ++counter)
.then(() => derive(cache, domain, key))

export const resync = (cache, domain) => cache.mongo
.then(db => db.collection(domain.root))
.then(coll => coll.find({}, { _id: 1 }).toArray())
.then(docs => docs
  .map(doc => doc._id)
  .map(id => updateCache(cache, domain, id, ++counter)
    .then(() => derive(cache, domain, id))
  )
)
