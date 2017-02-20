import { readFileSync } from 'fs'

export default domainFile => eval(`(${
  readFileSync(domainFile)
})`)
