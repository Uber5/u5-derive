import { join } from 'path'
import express from 'express'

import loadDomain from './load-domain'
import Cache from './cache'
import update from './update'
import { tailAndInvalidate } from './tail'

// load the domain
if (process.argv.length !== 3) {
  throw new Error('Must provide domain file as argument.')
}
const domainFile = process.argv[2]
const domain = loadDomain(join(__dirname, domainFile))

console.log('domain', domain)

const cache = new Cache()

// setup http service
const app = express()

app.get('/', (req, res) => res.send('Hello, U5-derive!'))
app.post('/update/:key', (req, res) => {
  const key = req.params.key
  console.log('update', key)
  update(cache, domain, key)
  .then(() => {
    console.log('domain updated', key)
    res.send('domain updated')
  })
  .catch(err => {
    console.log('err', err)
    res.status(500).send('Error while updating domain: ' + err.message)
  })
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`listening on port ${ port }`))

// setup mongodb tailing
const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME || 'u5-derive-dev'
tailAndInvalidate(tailUrl, tailDatabaseName, cache)
