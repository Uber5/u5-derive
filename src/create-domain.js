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
 * TODO: How to set the name of the function? Do we need example code?
 * TODO: We can define `types` better (via flow types)
 * 
 * ```javascript
 * import { createDomain } from 'u5-derive'
 * 
 * console.log('dummy')
 * ```
 * 
 */

export default (root: String, types: Array) => {
  invariant(root, '"root" must be provided')
  invariant(types instanceof Array, '"types" must be an array of types')
  return {
    root,
    types: typeObjectFromArray(types)
  }
}
