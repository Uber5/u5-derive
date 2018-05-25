import { ok } from 'assert'
import { ObjectId } from 'mongodb'
import { transact, derivation } from 'derivable'
import * as R from 'ramda'
import invariant from 'invariant'
import SeenKeysByType from './seen-keys-by-type'

const debug = require('debug')('u5-derive')

const derivedPropsKey = process.env.DERIVED_PROPS_KEY || '_D'

const updateCache = (cache, domain, key, counter) => {

  invariant(domain.root, 'Domain needs a "root" property')
  invariant(domain.types && Object.keys(domain.types).length > 0, 'Domain needs "types" property with at least one type')

  debug(`updateCache, domain ${ domain.root }, key=${ key }, counter=${ counter }`)

  const seenKeysByType = new SeenKeysByType()

  const findAndTraverse = (self, type, typeDef, relName /* other */, rel /* otherDef */, many = true) => {

    const other = rel.of || relName
    ok(other, `name for association ${ relName } missing`)
    const otherDef = domain.types[other]
    ok(otherDef, `unable to determine type for assocation '${ relName }' of '${ type }'`)

    const loader = cache.getLoader(other)

    if (!many && !rel.targetTypeHasForeignKey) {
      if (!self[rel.foreignKey]) { // we have no value
        debug('"self" has no foreign key', rel.foreignKey, self)
        self[relName] = derivation(() => null)
        return Promise.resolve([])
      }
    }

    const query = many || rel.targetTypeHasForeignKey
      ? {
          [rel.foreignKey]: self._id
        }
      : {
          _id: self[rel.foreignKey]
        }

    return Promise.resolve(cache.db.collection(other).find(query).toArray())
    .then(otherInstances => {

      otherInstances.forEach(i => {
        loader.prime(i._id, i)
        debug('primed loader', other, i._id, i)
      })
      return Promise.all(otherInstances.map(i => loader.load(i._id)))
    }).then(otherInstances => { 
      debug(
        'findAndTraverse, about to assign',
        relName, 'of type', type, 'with id', self._id,
        otherInstances.length,
        otherInstances.map(i => i._id),
        otherInstances
      )
      self[relName] = many
        ? derivation(() => otherInstances)
        : derivation(() => otherInstances.length > 0 ? otherInstances[0] : null)
      return otherInstances
    })
    .then(otherInstances => Promise.all(
      otherInstances.map(i => traverseToLoad(other, i._id))
    )).then(() => undefined)
  }

  function traverseToLoad(type, key) {
    invariant(key, `Missing key when querying cache, type=${type}`)
    const loader = cache.getLoader(type)
    return loader.load(key)
    .then(self => {
      invariant(self, `Instance not found, type=${type}, key=${key}`)
      const typeDef = domain.types[type]
      const { hasMany, hasOne } = typeDef

      debug('traverseToLoad, loaded', type, key)

      if (self.__version >= counter) {
        // concurrent load may result in newer version, should be idempotent
        // nevertheless
        debug('Breaking recursion', type, key)
        return Promise.resolve() // [] instead?
      }
      self.__version = counter

      // check if we have this already
      if (seenKeysByType.seen(type, key)) {
        debug('traverseToLoad, not loading again', type, key)
        return Promise.resolve([])
      } else {
        debug('traverseToLoad, not seen', type, key)
        seenKeysByType.add(type, key)
      }

      const hasManyPromises = Object.keys(hasMany || {})
      .map(relName => findAndTraverse(
        self, type, typeDef, relName, hasMany[relName]
      ))

      // TODO: almost the same as for 'hasMany' (only thing different is probably
      // how `self` should refer to the other(s)?)
      const hasOnePromises = Object.keys(hasOne || {})
      .map(relName => findAndTraverse(
        self, type, typeDef, relName, hasOne[relName], false /* not hasMany... */
      ))

      return Promise.all([ ...hasManyPromises, ...hasOnePromises ])
    })
  }

  return traverseToLoad(domain.root, key)
}

const doTraverse = (domain, type, o, cb) => {
  const seen = new Set()
  return traverse(type, o, cb)

  function traverse(type, o, cb) {

    const traverseAssociation = (self, type, typeDef, relName, rel, many = true) => {

      ok(self[relName], `Missing '${ relName }' from instance of '${ type }'`)

      const other = rel.of || relName // TODO: we don't really support leaving out 'of' for now
      const others = self[relName].get()

      if (many) {
        others.map(instance => traverse(other, instance, cb))
      } else {
        if (others) { // could be null
          return traverse(other, others, cb)
        }
      }
    }

    if (seen.has(type + o._id.toString())) {
      debug('aborting traversal, seen', type, o._id)
      return
    }
    seen.add(type + o._id.toString())

    debug('traverse (cb)', type, o)
    if (!cb(type, o)) {
      debug('aborting traversal, callback returned false')
    }

    const typeDef = domain.types[type]
    const { hasMany, hasOne } = typeDef
    Object.keys(hasMany || {})
    .map(relName => traverseAssociation(
      o, type, typeDef, relName, hasMany[relName]
    ))

    Object.keys(hasOne || {})
    .map(relName => traverseAssociation(
      o, type, typeDef, relName, hasOne[relName], false
    ))
  }
}

const derive = (cache, domain, key) => {

  debug('derive, root and key', domain.root, key)

  const loader = cache.getLoader(domain.root)
  return loader.load(key)
  .then(self => {
    transact(() => {
      doTraverse(domain, domain.root, self, (typeName, o) => {
        const type = domain.types[typeName]
        // debug('DERIVE?', type, o._id)
        Object.keys(type.derivedProps || []).map(propName => {
          const prop = type.derivedProps[propName]
          o[propName] = derivation(() => prop.f(o))
        })
        return true
      })
    })

    // store / update derived props
    const updates = []
    doTraverse(domain, domain.root, self, (typeName, o) => {
      const type = domain.types[typeName]
      const derivedProps = {}
      Object.keys(type.derivedProps || []).map(propName => {
        // debug(`o=${ o._id }, ${ propName }=${ o[propName].get() }`)
        derivedProps[propName] = o[propName].get()
      })
      // debug(`derivedProps(old)=`, o[derivedPropsKey], derivedProps)
      if (!o[derivedPropsKey] || !R.equals(o[derivedPropsKey], derivedProps)) {
        debug(`must update ${ typeName } ${ o._id }`, derivedProps)
        updates.push(cache.db.collection(typeName).findOneAndUpdate({
          _id: (o._id)
        }, {
          $set: { [derivedPropsKey]: derivedProps }
        }))
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
.then(coll => {
  debug('resync, about to find _ids of root', domain.root)
  return coll.find({}, { _id: 1 }).toArray()
})
.then(docs => {
  debug('resync, docs found', docs)
  return docs
})
.then(docs => docs
  .map(doc => doc._id)
  .map(id => updateCache(cache, domain, id, ++counter)
    .then(() => derive(cache, domain, id))
  )
)
