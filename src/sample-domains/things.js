{
  "types": {
    "things": {
      "hasOne": {
        "things": {
          "as": "previousThing",
          "foreignKey": "previousThingId"
        }
      },
      "derivedProps": {
        "distanceSoFar": {
          "f": self => self.previousThing
            ? self.previousThing.distanceSoFar.get() + self.distance
            : self.distance
        }
      },
      "inputProps": {
        "distance": {}
      }
    }
  },
  "root": "things"
}
