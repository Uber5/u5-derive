#!/bin/bash -ex

# We have this script in the gh-pages branch only, and we should run it only
# there.

CURRENT_BRANCH=`git rev-parse --abbrev-ref HEAD`
VERSION=`git describe --match "v[0-9]*" --abbrev=0 HEAD`

if [ $CURRENT_BRANCH != gh-pages ]; then
  echo "Must be run on the 'gh-pages' branch"
  exit 1
fi

git merge master --no-commit
git commit -m "merged master into doc branch"
rm -rf public/current/* public/versioned/$VERSION
mkdir public/versioned/$VERSION
npm run doc
cp -r ./docs/* ./public/current/
cp -r ./docs/* ./public/versioned/$VERSION/
git add public
git commit -m "Updated documentation"
git push origin gh-pages

echo "done"
