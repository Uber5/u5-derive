import express from 'express'

const app = express()

app.get('/', (req, res) => res.send('Hello, U5-derive!'))

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`listening on port ${ port }`))
