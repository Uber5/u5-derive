# u5-derive

Given complex business logic in Javascript and MongoDB, derive properties functionally.

In other words:

* Given
  * business data in MongoDB,
  * a description of derivable properties (see ./samples/simple/domain.js)
* When
  * state changes
* then
  * Derive properties.

# Status

Erm, don't use, not ready.

# Run example

For now:

```
./node_modules/.bin/supervisor -w src -- -r 'babel-register' src ./sample-domains/things.js
```


# Documentation

There is [experimental documentation](./docs.md).

# Run Tests

* Make *sure* you do the configuration to your MongoDB instance below.
* Note that by default `mongodb://localhost/u5-derive-test` will be used when
  running the test, as per
  [simple-domain-spec.js](./src/__tests__/simple-domain-spec.js) (this is not
  a clean setup...).
* Once done:

```bash
npm run test
```


# Configuration

Currently needed:

- `MONGO_TAIL_URL`
- `MONGO_TAIL_DATABASE_NAME`
- `MONGO_URL`

In addition, your local mongod may have to be configured as a standalone replica set:

* Make sure you run `mongod` with the parameter `--replSet test` (where "test"
  is the name of the replSet, could be a different name).
* initiate the replSet (inside a mongo shell) with:

```
rs.initiate({ _id: "test", version: 1, members: [ { _id: 1, host: "localhost:27017" } ] })
```

If you don't do this, you may get errors about "cursor not tailable" or similar.


# On the Implementation and Terminology

(just a beginning)

In order to speak about domain models, we require potentially unfamiliar, abstract
terminology: We can't say any more
"one person has many addresses" (concrete), we have to look at
"is it a to-one or a to-many association".

For this, terminology should (but currently isn't, at least not fully) aligned
with the
[UML terminology](https://en.wikipedia.org/wiki/Glossary_of_Unified_Modeling_Language_terms).
