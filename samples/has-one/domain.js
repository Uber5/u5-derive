import * as R from 'ramda'

export default {
  root: 'parts',
  types: {
    parts: {
      hasOne: {
        whole: {
          of: 'wholes',
          foreignKey: 'wholeId',
          targetTypeHasForeignKey: false // that's the default
        }
      },
      derivedProps: {
        valueFromWhole: {
          f: self => self.whole.get().value
        },
      }
    },
    wholes: {}
  }
}
