import { Cache, update as _update, tailAndInvalidate } from '..'
import domain from '../../samples/separate-types/domain'
import { mongo } from './config'

describe('separate types', () => {

  let update, thingsCollection
  
  beforeEach(() => mongo.then(db => {

    const cache = new Cache(mongo)

    // setup mongodb tailing
    const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
    const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'
    tailAndInvalidate(tailUrl, tailDatabaseName, cache)

    update = key => _update(cache, domain, key)
    thingsCollection = db.collection('things')

  }))
  
  const setupData = async () => {
    const db = await mongo
    // await thingsCollection.remove({})
    await thingsCollection.insert({ bla: 42 })
  }

  const updateAll = async () => {
    const things = await thingsCollection.find().toArray()
    return Promise.all(things.map(thing => update(thing._id)))
  }

  it('works', async () => {
    await setupData()
    await updateAll()
    const things = await thingsCollection.find({}).toArray()
    things.map(thing => expect(thing._D.value).toBe('some value'))
  })
})