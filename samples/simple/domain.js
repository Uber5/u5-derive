import * as R from 'ramda'

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
        },
        firstLegId: {
          f: self => {
            const legs = self.details.get()
            const nextLegIds = R.map(l => l.nextLegId, legs)
            const firstLeg = R.find(l => R.not(R.contains(l._id, nextLegIds)), legs)
            return firstLeg && firstLeg._id
          }
        },
        lastLegId: {
          f: self => {
            const legs = self.details.get()
            const lastLeg = R.find(l => typeof(l.nextLegId) === 'undefined', legs)
            return lastLeg && lastLeg._id
          }
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
          f: self => {
            // console.log('distanceSoFar', self.distance, self.previousLeg.get())
            return self.distance
              + (self.previousLeg.get()
                ? self.previousLeg.get().distanceSoFar.get()
                : 0)
            }
        }
      }
    }
  }
}
