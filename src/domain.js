// @flow

export type DomainType = {
  hasMany: any,
  hasOne: any,
  derivedProps: any
}

export type Types = {
  [string]: DomainType
}

export type Domain = {
  root: string,
  types: Types,
  derivedPropsKey?: string
}
