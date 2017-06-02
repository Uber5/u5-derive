# u5-derive

Given

* business data in MongoDB,
* a description of derivable properties (see ./samples/simple/domain.js)

When

* state changes

then

* Derive properties.

# Status

Erm, don't use, not ready.

# Run example

For now:

```
./node_modules/.bin/supervisor -w src -- -r 'babel-register' src ./sample-domains/things.js
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
