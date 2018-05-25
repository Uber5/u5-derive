import { Cache, update as _update, tailAndInvalidate } from '..'
import { mongo as client } from './config'
import { simplifiedInsert, findById } from './simple-domain-spec'
import domain from '../../samples/has-one/domain'

describe('simple domain', () => {

  let cache, update

  beforeEach(() => client.then(client => client.db()).then(db => {

    cache = new Cache(db)

    const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
    const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'
    tailAndInvalidate(tailUrl, tailDatabaseName, cache)

    update = key => _update(cache, domain, key)

  }))

  it('has reference to the "hasOne" object/document', () => {

    const testValue = 42
    return simplifiedInsert('wholes', { value: testValue })
    .then(whole => Promise.all([
      whole,
      simplifiedInsert('parts', { wholeId: whole._id })
    ]))
    .then(([ whole, part ]) => Promise.all([
      whole,
      part,
      update(part._id)
    ]))
    .then(([ whole, part, result ]) => findById('parts', part._id))
    .then(part => {
      expect(part._D.valueFromWhole).toBe(testValue)
    })
  })
})
