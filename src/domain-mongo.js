import { MongoClient } from 'mongodb'

import findRootKeys from './find-root-keys'
import { Domain } from './domain'
import { update as _update } from './update'
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
        // debug('calling collection Fn', fnName)

        switch (fnName) {
          case 'deleteOne':
            const filter = arguments[0]
            return wrapper.findOne(filter).then(async doc => {
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                doc,
                state.rootKeysToUpdate
              )
              enqueue(state)
            })
            .then(() => original.deleteOne.apply(this, arguments))
            .then(res => {
              dequeue(state)
              return res
            })
            .catch(err => { dequeue(state); throw err })
          default: // fall through
        }

        // if we didn't return above (we sometimes so), then we call
        // the original function now
        const result = original[fnName].apply(this, arguments)

        // and sometimes do some processing afterwards
        switch (fnName) {
          case 'insertOne':
            enqueue(state)
            result.then(async res => {
              debug(`insertOne done, insertedId:`, res.insertedId)
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                arguments[0],
                state.rootKeysToUpdate
              )
              dequeue(state)
            }).catch(err => { dequeue(state); throw err })
            break
          case 'findOneAndUpdate':
            enqueue(state)
            result.then(async res => {
              await findRootKeys(
                state.domain,
                state.db,
                collName,
                res.value,
                state.rootKeysToUpdate
              )
              dequeue(state)
            }).catch(err => {
              dequeue(state)
              throw err
            })
            break
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

const domainMongo = async ({ domain, mongoUrl }) => {
  const wrappedDb = await MongoClient.connect(mongoUrl)

  // TODO: Cache should have resolved promise of connect() as constructor arg?
  const cache = new Cache(MongoClient.connect(mongoUrl))

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
          return update(key)
        })
      )
    )
  }

  return wrapper
}

export default domainMongo