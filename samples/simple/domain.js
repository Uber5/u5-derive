export default {
  root: 'journeys',
  types: {
    journeys: {
      hasMany: {
        legs: {
          as: 'details',
          foreignKey: 'journeyId'
        },
        journeys: { // TODO: what if we have multiple 'hasMany' to the same other type?
          as: 'shouldDoNext',
          foreinKey: 'shouldDoAfter'
        }
      },
      derivedProps: {
        numLegs: {
          f: self => self.details.get().length
        }
      }
    },
    legs: {
    }
  }
}
