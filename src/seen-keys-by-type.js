export default class SeenKeysByType {
  constructor() {
    this.byType = {}
  }
  add(type, key) {
    if (!this.byType[type]) {
      this.byType[type] = new Set()
    }
    this.byType[type].add(key.toString())
  }
  seen(type, key) {
    const byType = this.byType[type]
    if (!byType) {
      return false
    }
    return byType.has(key.toString())
  }
}