import MongoOplog from 'mongo-oplog'

const debug = require('debug')('u5-derive')

export const tailAndInvalidate = (url, dbName, cache) => {
  const oplog = MongoOplog(url, { ns: `${ dbName }.*` })

  oplog.tail()

  /** TODO: on insert... we certainly won't have this document in our cache yet!
  oplog.on('insert', doc => {
    const type = doc.ns.match(`^${ dbName }\.(.+)$`)[1]
    const key = doc.o2._id
  })
  */

  const invalidate = (type, key) => {
    debug(`invalidate ${ type } ${ key }`)
    if (cache.hasLoader(type)) {
      cache.getLoader(type).clear(key)
      debug(`cleared from cache: ${ type } ${ key }`)
    }
  }

  oplog.on('update', doc => {
    const type = doc.ns.match(`^${ dbName }\.(.+)$`)[1]
    const key = doc.o2._id
    invalidate(type, key)
  })

  oplog.on('delete', doc => {
    const type = doc.ns.match(`^${ dbName }\.(.+)$`)[1]
    const key = doc.o._id
    invalidate(type, key)
  })

}
