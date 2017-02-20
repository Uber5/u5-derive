{
  "types": {
    "things": {
      "hasOne": {
        "things": {
          "as": "previousThing"
        }
      },
      "derivedProps": {
        "distanceSoFar": {
          "f": () => this.previousThing ? this.previousThing.distanceSoFar + this.d : this.d
        }
      },
      "inputProps": {
        "d": {}
      }
    }
  },
  "root": "things"
}
