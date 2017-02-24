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
          "f": function() {
            console.log('distanceSoFar', this.previousThing ? true : false, this)
            return this.previousThing
              ? this.previousThing.distanceSoFar.get() + this.distance
              : this.distance
          }
        }
      },
      "inputProps": {
        "distance": {}
      }
    }
  },
  "root": "things"
}
