# u5-derive

Given

* business data in MongoDB,
* a description of derivable properties (see ./src/sample-domains)

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
