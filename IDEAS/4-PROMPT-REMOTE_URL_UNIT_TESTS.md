In the existing unit-tests.sh file, write a test suite that validates ALL remote urls found in "commands/\*md". This will confirm they are all reachable. We will regex search, and check ALL urls that start with "https://code.amazon.com/". Other links ignore for now. Regarding the response body and what the endpoint returns, we don't care. We just validate it returns 200 status.

```
curl -fsSL --max-time 20 --cookie ~/midway/TODO.txt https://code.amazon.com/TODO/path/to/file/foobar-script.sh
```

```
URL="https://example.com"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
[ "$STATUS" -eq 200 ] && echo "✅ 200 OK" || { echo "❌ Failed: $STATUS"; exit 1; }
```

Note, we should IGNORE the template URls that have "<" or ">" in the name. like this: `https://code.amazon.com/<PackageName>`
