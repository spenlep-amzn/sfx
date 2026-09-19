I need to extend the existing unit test file: unit-tests.sh

Please add a test suite for this: "Detect hard-coded alias"

We need to grep all the files in `commands/*.md` for this pattern:

```
MY_ALIAS="spenlep"
# grep for any instances of `MY_ALIAS` in the *.md files
```

If there are any matches, we should FAIL, and log "found hard-coded alias: [file][line]"
