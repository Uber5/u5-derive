import { createDomain } from '../../src'

export default createDomain({
  root: 'things',
  types: [
    { type: 'things', definition: require('./things').default },
    { type: 'otherThings', definition: require('./other-things').default }
  ]
})