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
          "f": () => this.previousThing ? this.previousThing.distanceSoFar + this.distance : this.distance
        }
      },
      "inputProps": {
        "d": {}
      }
    }
  },
  "root": "things"
}
