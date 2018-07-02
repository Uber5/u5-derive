//@flow
import { MongoClient, Db, ObjectId } from 'mongodb'
import invariant from 'invariant'

import findRootKeys from './find-root-keys'
import type { Domain } from './domain'
import { update as _update, resync } from './update'
import Cache from './cache'

const debug = require('debug')('u5-derive:domain-mongo')

const initResolverWhenDoneWaiting = state => {
  if (state.resolver) {
    state.resolver()
  }
  state.resolvedWhenDoneWaiting = new Promise(res => state.resolver = res)
}

const enqueue = state => {
  if (state.numWaiting++ === 0) {
    initResolverWhenDoneWaiting(state)
  }
  debug('enqueue, numWaiting', state.numWaiting)
}

const dequeue = state => {
  state.numWaiting -= 1
  debug('dequeue, numWaiting', state.numWaiting)
  if (state.numWaiting === 0) {
    initResolverWhenDoneWaiting(state)
  }
}

const wrapCollectionObj = (original, collName, state) => {
  const wrapper = {}
  for (let prop in original) {
    if (typeof (original[prop]) === 'function') {
      const fnName = prop
      wrapper[fnName] = function () {

        debug(`calling collection fn ${fnName} for collection ${collName}.`)

        switch (fnName) {
          case 'updateMany':
          {
            const query = arguments[0]
            enqueue(state)
            return original.find(query).toArray()
            .then(docs => Promise.all(docs.map(doc => findRootKeys(
              state.domain,
              state.db,
              collName,
              doc,
              state.rootKeysToUpdate
            ))))
            .then(() => original.updateMany.apply(original, arguments))
            .then(result => Promise.all([
              result,
              original.find(query).toArray()
            ]))
            .then(([ result, docs ]) => {
              const docsPromises = docs.map(doc => findRootKeys(
                state.domain,
                state.db,
                collName,
                doc,
                state.rootKeysToUpdate
              ))
              return Promise.all([
                result,
                ...docsPromises
              ])
            }).then(([ result, ...ignore ]) => {
              dequeue(state)
              return result
            })
            // break ... is unreachable
          }
          case 'findOneAndDelete':
          case 'deleteOne':
          {
            const filter = arguments[0]
            return wrapper.findOne(filter).then(async doc => {
              enqueue(state)
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                doc,
                state.rootKeysToUpdate
              )
            })
            .then(() => original.deleteOne.apply(original, arguments))
            .then(res => {
              dequeue(state)
              return res
            })
            .catch(err => { dequeue(state); throw err })
          }
          case 'deleteMany':
          {
            if (collName === state.domain.root) {
              // don't do anything, as root instance(s) will disappear, which
              // leaves nothing to update
              break
            }
            const filter = arguments[0]
            return wrapper.find(filter).toArray().then(async docs => {
              enqueue(state)
              for (let doc of docs) {
                debug(`deleteMany, adding root key, id`, doc._id)
                await findRootKeys(
                  state.domain,
                  state.db,
                  collName,
                  doc,
                  state.rootKeysToUpdate
                )  
              }
            }).then(
              () => original[fnName].apply(original, arguments)
            ).then(() => {
              dequeue(state)
            }).catch(err => { dequeue(state); throw err })
          }
          case 'findOneAndReplace':
          case 'findOneAndUpdate':
          {
            enqueue(state)
            const filter = arguments[0]
            return original.findOne(filter)
            .then(async doc => await findRootKeys(
              state.domain,
              state.db,
              collName,
              doc,
              state.rootKeysToUpdate
            ))
            .then(async () => await original[fnName].apply(original, arguments))
            .then(result => Promise.all([
              result,
              original.findOne(filter)
            ]))
            .then(async ([ result, doc ]) => {
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                doc,
                state.rootKeysToUpdate
              )
              dequeue(state)
              return result
            }).catch(err => {
              dequeue(state)
              throw err
            })
          }
          case 'findAndRemove':
          case 'findAndModify':
          case 'insert':
          case 'remove':
          case 'save':
          case 'update':
            throw new Error(`${fnName} is deprecated, therefore not supported by u5-derive.`)
          case 'bulkWrite':
          case 'initializeOrderedBulkOp':
          case 'initializeUnorderedBulkOp':
          case 'replaceOne': // TODO: use findOneAndReplace instead?
          case 'updateOne': // TODO: use findOneAndUpdate instead?
            throw new Error(`${fnName} is not supported (but could be added if required).`)
          default: // fall through
        }

        // if we didn't return above (we sometimes so), then we call
        // the original function now
        const result = original[fnName].apply(original, arguments)

        // and sometimes do some processing afterwards
        switch (fnName) {
          case 'insertOne':
            enqueue(state)
            return result.then(async res => {
              debug(`insertOne done, insertedId:`, res.insertedId)
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                arguments[0],
                state.rootKeysToUpdate
              )
              dequeue(state)
              return res
            }).catch(err => { dequeue(state); throw err })
          case 'insertMany':
            enqueue(state)
            return result.then(async res => {
              for (let doc of arguments[0]) {
                debug(`insertMany, id inserted: ${doc._id}`)
                await findRootKeys(
                  state.domain,
                  state.db,
                  collName,
                  doc,
                  state.rootKeysToUpdate
                )
              }
              dequeue(state)
              return res
            }).catch(err => { dequeue(state); throw err })
          case 'deleteOne':
          default:
          // do nothing
        }
        return result
      }
    } else {
      wrapper[prop] = original[prop]
    }
  }
  return wrapper
}

const wrapCollectionFn = (db, state) => function () {
  const coll = db.collection.apply(this, arguments)
  const collectionName = arguments[0]
  // debug('getting collection', collectionName)
  if (!state.collectionWrappers[collectionName]) {
    state.collectionWrappers[collectionName] = wrapCollectionObj(coll, collectionName, state)
  }
  return state.collectionWrappers[collectionName]
}

const domainMongo = async (
  { domain, mongoUrl }: { domain: Domain, mongoUrl: string }
): Db => {
  invariant(domain, 'argument is missing "domain" property.')
  invariant(mongoUrl, 'argument is missing "mongoUrl" property.')
  const mongoClient = await MongoClient.connect(mongoUrl)
  const wrappedDb = mongoClient.db(/*mongoClient.s.options.dbName*/)
  const cache = new Cache(wrappedDb)

  const state = {
    collectionWrappers: {}, // maps collection name to collection wrapper
    domain,
    numWaiting: 0,
    rootKeysToUpdate: new Set(),
    db: wrappedDb
  }
  initResolverWhenDoneWaiting(state)

  // we must wrap the Collection class 
  // ... and then record all root ids that we need to run an update on, for
  // each function that changes a type we know in the domain

  const wrapper = {}
  for (let prop in wrappedDb) {
    if (typeof (wrappedDb[prop]) === 'function') {
      switch (prop) {
        case 'collection':
          wrapper.collection = wrapCollectionFn(wrappedDb, state)
          break
        default:
          wrapper[prop] = wrappedDb[prop]
      }
    } else {
      wrapper[prop] = wrappedDb[prop]
    }
  }

  const update = key => _update(cache, domain, key)

  wrapper.updateDomainNow = async () => {
    cache.clear()
    const promise = state.resolvedWhenDoneWaiting
    if (state.numWaiting === 0) {
      initResolverWhenDoneWaiting(state)
    }
    const rootKeys = Array.from(state.rootKeysToUpdate)
    debug('updateDomainNow, rootKeys', rootKeys)
    state.rootKeysToUpdate = new Set()
    return promise.then(
      async () => Promise.all(
        Array.from(rootKeys).map(async key => {
          debug('About to update (from rootKeys)', key)
          return update(new ObjectId(key))
        })
      )
    )
  }

  const _resync = () => resync(cache, domain)
  wrapper.resync = _resync

  return wrapper
}

export default domainMongo