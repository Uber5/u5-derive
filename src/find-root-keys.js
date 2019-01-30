// @flow
import { Db } from 'mongodb'
import { isEmpty, path } from 'ramda'
import { DomainType } from './domain'

const debug = require('debug')('u5-derive:find-root-keys')

const hasManyOfType = (type: DomainType, typeName: string): boolean => 
  type.hasMany && type.hasMany[typeName] && type.hasMany[typeName].of === typeName
const hasOneOfType = (type: DomainType, typeName: string): boolean => 
  type.hasOne && type.hasOne[typeName] && type.hasOne[typeName].of === typeName
  
const hasAnyOfType = (type, typeName) =>
  hasManyOfType(type, typeName) || hasOneOfType(type, typeName)

const getReferringTypes = (domain: Domain, typeName: string) => {
  return Object.entries(domain.types).filter(([ referringType, typeDef ]) => {
    debug('getReferringTypes', referringType, typeDef)
    return hasAnyOfType(typeDef, typeName)
  })
}

const instanceProp = (key, instance) => path(key.split('.'), instance)

const findRootKeys = async (
  domain: Domain,
  db: Db,
  type: string,
  instance: Object,
  rootKeys = new Set()
): Set<string> => {

  // TODO: we have to check if this type/instance._id has been visited already

  if (!instance || typeof instance !== 'object') {
    throw new Error(`findRootKeys, instance must be an object, type=${type}`)
  }
  if (type === domain.root) {
    debug('Adding rootKey (1)', type, instance._id)
    rootKeys.add(instance._id.toString())
  }
  const assocTypes = [ 'hasOne', 'hasMany' ]
  const referringTypes = getReferringTypes(domain, type)
  debug('referringTypes', referringTypes, 'type', type)
  for (let [ otherName, otherType ] of referringTypes) {
    debug('referringType', otherName, otherType)
    for (let assocType of assocTypes) { // hasOne, hasMany
      const assocs = otherType && otherType[assocType]
      const assocEntries = Object.entries(assocs || {})
      for (let [ assocName, assoc ] of assocEntries) {
        if (assoc.of === type) {
          debug(`findRootKeys, type=${type}, otherName=${otherName}, foreignKey=${assoc.foreignKey}`)
          const key = instanceProp(assoc.foreignKey, instance)
          debug(`findRootKeys, key=${key}, otherName=${otherName}, domain.root=${domain.root}`)
          if (otherName === domain.root) {
            // const key = instance[assoc.foreignKey]
            if (key) {
              debug('Adding rootKey', instance, key)
              rootKeys.add(key.toString())
            } else {
              debug('*Not* adding rootKey, as falsy', instance, assoc.foreignKey)
            }
          } else {
            const otherInstance = await db.collection(otherName).findOne({ _id: key })
            debug('findRootKeys (recurse)', otherName, assoc.foreignKey, instance, otherInstance)
            await findRootKeys(domain, db, otherName, otherInstance, rootKeys)
          }
        }
      }
    }
  }
  return rootKeys
}

export default findRootKeys
