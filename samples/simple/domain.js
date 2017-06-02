import * as R from 'ramda'

export default {
  root: 'journeys',
  types: {
    journeys: {
      hasMany: {
        details: {
          of: 'legs',
          foreignKey: 'journeyId'
        },
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
        previousLeg: {
          of: 'legs',
          foreignKey: 'nextLegId',
          targetTypeHasForeignKey: true
        }
      },
      derivedProps: {
        distanceSoFar: {
          f: self => {
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
