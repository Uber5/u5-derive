export default {

  hasMany: {
    otherThings: {
      of: 'otherThings',
      foreignKey: 'thingId'
    }
  },

  derivedProps: {
    value: {
      f: self => 'some value'
    }
  }
  
}