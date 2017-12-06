import { mongo } from './config'

/**
 * Idea: we should be able to wait via a Promise until all expected updates
 * (to root instances of the domain) are finished.
 */

describe('Waiting for updates', () => {
  it('works', async () => {
    const db = await mongo
    const things = db.collection('things')
    const parts = db.collection('parts')
    const thing = { name: `New thing at ${new Date}` }
    await things.insertOne(thing)
    console.log('thing', thing)
    const part = {
      name: `This is a part of thing ${thing._id}`,
      thingId: thing._id
    }
    await parts.insertOne(part)
    console.log('part', part)
  })
})