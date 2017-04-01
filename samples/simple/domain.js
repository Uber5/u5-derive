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
      hasOne: {
        legs: {
          as: 'previousLeg',
          foreignKey: 'nextLegId'
        }
      },
      derivedProps: {
        distanceSoFar: {
          f: self => self.distance
            + self.previousLeg.get()
              ? self.previousLeg.get().distanceSoFar.get()
              : 0
        }
      }
    }
  }
}
