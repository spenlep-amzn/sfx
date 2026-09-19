## Background

I need to extend the existing unit test file: unit-tests.sh

Please add a test suite for this: "Claude Code Model Helpers"

we'll need to scan these three files hard-coded:
commands/sonnet.md
commands/opus.md
commands/fable.md

In the file's themselves, it's just one line:

```
/model claude-sonnet-5
```

I need to write a super simple unit test that FACT checks this. I need to make sure that claude currently has access to this model, and verify the modelId provided. I can't run this in my claude chat directly, so either there's a built in cli command / flag to list model ids, OR we need a hacky thing like manually running a bash command and seeing what happens: `claude -p "/model claude-sonnet-5"`

## Output

Update unit-tests.sh with a scoped test suite. I already tested this logic we can use:

```
#!/bin/bash
#
# Unit tests for this repo's Claude Code helpers.
#
# Usage:
#   ./test.sh          # offline-safe checks (no API calls)
#   ./test.sh --live   # also make one tiny real API call per model to prove access

cd "$(dirname "$0")" || exit 1

LIVE=0
[ "$1" = "--live" ] && LIVE=1

PASSED=0
FAILED=0

pass() { echo "  ✅ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ❌ $1"; FAILED=$((FAILED + 1)); }

# ---------------------------------------------------------------------------
# Suite: Claude Code Model Helpers
#
# Each helper is a one-line slash command: `/model <model-id>`.
# For each one we check that:
#   1. the file contains exactly `/model <expected-id>`
#   2. Claude Code accepts the id (`claude -p "/model <id>"`); unknown ids print
#      "Model '...' not found", and gated models surface access errors here too
#   3. (--live only) the account can actually use the model
# ---------------------------------------------------------------------------
echo "Suite: Claude Code Model Helpers"

MODEL_HELPERS=(
  ".claude/commands/sonnet.md:claude-sonnet-5"
  ".claude/commands/opus.md:claude-opus-5"
  ".claude/commands/fable.md:claude-fable-5-1"
)

for entry in "${MODEL_HELPERS[@]}"; do
  file="${entry%%:*}"
  expected_id="${entry#*:}"
  echo "- $file"

  if [ ! -f "$file" ]; then
    fail "file not found"
    continue
  fi

  # 1. File content is exactly `/model <id>`
  content=$(tr -d '\r' < "$file" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
  if [ "$content" = "/model $expected_id" ]; then
    pass "contains '/model $expected_id'"
  else
    fail "expected '/model $expected_id', found '$content'"
    continue
  fi

  # 2. Claude Code accepts the model id
  out=$(claude -p "$content" 2>&1 < /dev/null)
  if echo "$out" | grep -q "^Set model to"; then
    pass "claude recognizes $expected_id ($out)"
  else
    fail "claude cannot use $expected_id: $(echo "$out" | head -c 200)"
    continue
  fi

  # 3. Optional: real request proves access (costs a few tokens)
  if [ "$LIVE" -eq 1 ]; then
    out=$(echo "Reply with the single word: ok" | claude -p --model "$expected_id" --no-session-persistence 2>&1)
    if [ $? -eq 0 ] && echo "$out" | grep -qi "ok"; then
      pass "live call to $expected_id succeeded"
    else
      fail "live call to $expected_id failed: $(echo "$out" | head -c 200)"
    fi
  fi
done

echo
echo "Passed: $PASSED  Failed: $FAILED"
[ "$FAILED" -eq 0 ]
```
