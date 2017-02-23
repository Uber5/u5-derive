import { MongoClient } from 'mongodb'

export const mongoUrl = process.env.MONGO_URL || `mongodb://localhost/u5-derive-dev`

const mongo = MongoClient.connect(mongoUrl)
export default mongo
