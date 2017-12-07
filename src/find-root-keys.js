// @flow
import { isEmpty } from 'ramda'

export type DomainType = {
  hasMany: any,
  hasOne: any,
  derivedProps: any
}

export type Types = {
  [string]: DomainType
}

export type Domain = {
  root: string,
  types: Types
}

const hasManyOfType = (type: DomainType, typeName: string): boolean => 
  type.hasMany && type.hasMany[typeName] && type.hasMany[typeName].of === typeName
const hasOneOfType = (type: DomainType, typeName: string): boolean => 
  type.hasOne && type.hasOne[typeName] && type.hasOne[typeName].of === typeName
  
const hasAnyOfType = (type, typeName) =>
  hasManyOfType(type, typeName) || hasOneOfType(type, typeName)

const getReferringTypes = (domain: Domain, typeName: string) => {
  return Object.entries(domain.types).filter(([ referringType, typeDef ]) => {
    // console.log('getReferringTypes', referringType, typeDef)
    return hasAnyOfType(typeDef, typeName)
  })
}

const findRootKeys = async (
  domain: Domain,
  findOne: (query: Object) => Promise,
  type: string,
  instance: Object,
  rootKeys = new Set(): Set<string>
): Set<string> => {

  const assocTypes = [ 'hasOne', 'hasMany' ]
  const referringTypes = getReferringTypes(domain, type)
  console.log('referringTypes', referringTypes, 'type', type)
  for (let [ otherName, otherType ] of referringTypes) {
    console.log('referringType', otherName, otherType)
    for (let assocType of assocTypes) { // hasOne, hasMany
      const assocs = otherType && otherType[assocType]
      const assocEntries = Object.entries(assocs || {})
      for (let [ assocName, assoc ] of assocEntries) {
        if (assoc.of === type) {
          console.log(`findRootKeys, type=${type}, otherName=${otherName}, foreignKey=${assoc.foreignKey}`)
          if (otherName === domain.root) {
            rootKeys.add(instance[assoc.foreignKey])
          } else {
            console.log('About to findOne', otherName, assoc.foreignKey, instance)
            const otherInstance = await findOne({ _id: instance[assoc.foreignKey] })
            await findRootKeys(domain, findOne, otherType, otherInstance, rootKeys)
          }
        }
      }
    }
  }
  return rootKeys
}

export default findRootKeys
