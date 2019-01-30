import { MongoClient } from 'mongodb'

export const mongoUrl = process.env.MONGO_URL_TEST || `mongodb://localhost:27017/u5-derive-test`
export const mongo = MongoClient.connect(mongoUrl, { useNewUrlParser: true })
export const mongoDb = mongo.then(m => m.db())
export const tailUrl = process.env.MONGO_TAIL_URL || 'mongodb://localhost/local'
export const tailDatabaseName = process.env.MONGO_TAIL_DATABASE_NAME_TEST || 'u5-derive-test'

it('sets up configuration', () => {})