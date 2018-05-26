import { Cache, update as _update, tailAndInvalidate } from '..'
import domain from '../../samples/separate-types/domain'
import { mongo } from './config'

describe('separate types', () => {

  let update, thingsCollection, someKey
  
  beforeEach(() => mongo.then(client => client.db()).then(db => {

    const cache = new Cache(db)

    // setup mongodb tailing
    const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
    const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'
    tailAndInvalidate(tailUrl, tailDatabaseName, cache)

    update = key => _update(cache, domain, key)
    thingsCollection = db.collection('things')
    someKey = `${ new Date().getTime() }-${Math.random()}` // dirty: unique'ish key
  }))
  
  const setupData = async () => {
    const db = await mongo
    // await thingsCollection.remove({})
    await thingsCollection.insert({ someKey, bla: 42 })
  }

  const updateAll = async () => {
    const things = await thingsCollection.find({ someKey }).toArray()
    return await Promise.all(things.map(thing => update(thing._id)))
  }

  it('works', async () => {
    await setupData()
    const updateAllResult = await updateAll()
    const things = await thingsCollection.find({ someKey }).toArray()
    things.map(thing => expect(thing._D.value).toBe('some value'))
  })
})