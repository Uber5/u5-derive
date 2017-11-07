import { createDomain } from '../../src'

export default createDomain(
  'things',
  [
    { type: 'things', definition: require('./things').default },
    { type: 'otherThings', definition: require('./other-things').default }
  ]
)