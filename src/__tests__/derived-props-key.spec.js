import { createDomain, domainMongo } from '..'
import { mongoDb } from './config'

describe('Configurable key for derived props', () => {
  it('can be configured when creating the domain', async () => {
    const domain = createDomain(
      'things',
      [
        {
          type: 'things',
          definition: {
            derivedProps: {
              field1: {
                f: self => 42
              }
            }
          }
        },
      ],
      'customPropsKey'
    )
    const mongoDomain = await domainMongo({ domain, mongoDb })
    const things = mongoDomain.collection('things')
    const { insertedId } = await things.insertOne({ someData: 'blabla' })
    await mongoDomain.updateDomainNow()
    const fetched = await things.findOne({ _id: insertedId })
    expect(fetched.customPropsKey.field1).toBe(42)
  })
})