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

export default ({ root, types }) => {
  invariant(root, '"root" must be provided')
  invariant(types instanceof Array, '"types" must be an array of types')
  return {
    root,
    types: typeObjectFromArray(types)
  }
}