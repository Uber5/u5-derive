// @flow

type Domain = {
  root: string,
  types: Object
}

export default (domain: Domain, type: string, instance: Object): Set<string> => {
  return new Set()
}