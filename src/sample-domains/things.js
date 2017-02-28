{
  "types": {
    "things": {
      "hasOne": {
        "things": {
          "as": "previousThing",
          "foreignKey": "nextThingId"
        },
      },
      "hasMany": {
        "details": {
          "as": "detailsOfThings",
          "foreignKey": "thingId"
        }
      },
      "derivedProps": {
        "distanceSoFar": {
          "f": self => self.previousThing
            ? self.previousThing.distanceSoFar.get() + self.distance
            : self.distance
        },
        "sumOfDetails": {
          "f": self => self.detailsOfThings
            .map(d => d.counter || 0)
            .reduce((acc, d) => acc + d, 0)
        }
      },
      "inputProps": {
        "distance": {}
      }
    },
    "details": {}
  },
  "root": "things"
}
