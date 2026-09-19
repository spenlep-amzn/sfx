## TODO-HUMAN

Create `.claude/scripts/test-script.sh` for testing purposes, before the full migration

```
echo "Starting test script execution..."
echo "Random number generated: $RANDOM"
echo "Test script completed successfully."
```

Spin up adhoc claude session, run this in a one-shot.

## Background

We migrated our source code in this prior task: IDEAS/2-EXTRACT_SH_SCRIPTS.md

Now, I need to add unit test coverage for this new folder now: .claude/scripts/\*.sh

Note, we could have .sh, .js, or .py, but I ONLY care about .sh right now. Add a PLACEHOLDER_TODO command for Node.js coverage, but say it's out of scope for now.

This new unit test suite will scan ALL the .claude/scripts/\*.sh files in this folder.

Then, the unit test itself needs to execute the script to verify it's valid code. We don't care about linting, we don't care about the output of the script, we just care that it RUNS without existing.

The is a super simple test, it's asserting exit 0 basically.

It's just a light-weight validation to catch breaking code changes at build-time, rather than runtime.

Some of these script might have internet calls and slow logic, so use a hard-coded 30sec timer hard-cap. If the script takes longer than 30sec, mark it failed.

Execute these .sh script one at a time, sequentially.

Note, I need this to be able to run on MacOS OR Amazon Linux machines, agnostic.

New test suite psuedo-code to append: (please finalize and test this)

```

# Lightweight build-time validation for extracted scripts.
# Runs every .claude/scripts/*.sh one at a time and asserts it exits 0.
# Output of the scripts is ignored; each run is hard-capped at 30 seconds.
# Portable across macOS and Amazon Linux (bash + coreutils only).

# TODO: [PLACEHOLDER_TODO] Add Node.js script coverage (.claude/scripts/*.js) - Out of scope for now.

# Always resolve paths relative to the repo root, regardless of caller's cwd
cd "$(dirname "$0")" || exit 1

SCRIPTS_DIR=".claude/scripts"
TIMEOUT_SECONDS=30
POLL_INTERVAL=0.1
MAX_POLLS=$((TIMEOUT_SECONDS * 10))

failed=0

for script in "$SCRIPTS_DIR"/*.sh; do
    [ -f "$script" ] || continue

    # Run in the background so we can enforce the hard cap; discard output and stdin
    bash "$script" >/dev/null 2>&1 </dev/null &
    pid=$!

    polls=0
    timed_out=0
    while kill -0 "$pid" 2>/dev/null; do
        if [ "$polls" -ge "$MAX_POLLS" ]; then
            kill -9 "$pid" 2>/dev/null
            timed_out=1
            break
        fi
        sleep "$POLL_INTERVAL"
        polls=$((polls + 1))
    done

    wait "$pid" 2>/dev/null
    exit_code=$?

    if [ "$timed_out" -eq 1 ]; then
        echo "✖ $script -> FAILED (Timeout after ${TIMEOUT_SECONDS}s)"
        failed=$((failed + 1))
    elif [ "$exit_code" -eq 0 ]; then
        echo "✔ $script -> PASSED"
    else
        echo "✖ $script -> FAILED (Exit Code: $exit_code)"
        failed=$((failed + 1))
    fi
done

if [ "$failed" -gt 0 ]; then
    echo "=== Test Suite Failed: $failed script(s) failed validation ==="
    exit 1
else
    echo "=== All Shell Scripts Passed Validation ==="
    exit 0
fi
```

## End-to-end Test / Success Criteria

Run the unit test suite and make sure it passes.

All of the .sh scripts are known to be valid, we don't expect any errors.
if you see any errors, escalate to me and wait for input
