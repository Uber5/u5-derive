// @flow
import invariant from 'invariant'

const typeObjectFromArray = types => types.reduce(
  (accum, tp) => {
    invariant(tp.type, 'type require "type" property (name of type)')
    invariant(tp.definition, 'type requires "definition" property')
    accum[tp.type] = tp.definition
    return accum
  },
  {}
)

/**
 * Create a domain (required to call the `update` function) from an object
 * describing the domain.
 * 
 * This is a bit silly, it really just transforms from one representation
 * to the other... we can design this API better, let's try soon?
 * 
 * If your goal is to keep types in separate files, use it like this:
 * 
 * ```javascript
 * const domain = createDomain(
 *   'things',
 *   [
 *     { type: 'things', definition: require('./things').default },
 *     { type: 'otherThings', definition: require('./other-things').default }
 *   ]
 *  )
 * ```
 * 
 * ... and then use the `domain` when calling `update()`.
 * 
 */

type Type = {
  type: string,
  definition: any
}

export default (root: string, types: Array<Type>) => {
  invariant(root, '"root" must be provided')
  invariant(types instanceof Array, '"types" must be an array of types')
  return {
    root,
    types: typeObjectFromArray(types)
  }
}
