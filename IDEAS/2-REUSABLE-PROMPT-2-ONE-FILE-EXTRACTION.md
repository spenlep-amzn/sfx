## HUMAN-TODO

store this prompt in resources/REUSABLE-PROMPT-2-ONE-FILE-EXTRACTION.md
-> ~/workplace/SpenlepAgents/src/SpenlepAgents/resources/REUSABLE-PROMPT-2-ONE-FILE-EXTRACTION.md

# AUTOMATED SH EXTRACTION MIGRATION

## Input

User provides a single markdown file: "commands/my-file.md"

## Role

You are the master agent, you trigger a loop, migrating one code block piece at a time, until you identify NONE left to migrate.

## Steps

**Run this loop**

1. Read the prompt.md file, search for code blocks <markdown>``<code>`</markdown>
2. Parse results, identify if there are any inline markdown .sh snippets that we could extract
   - ignore .json, .js, .ts, .py, ...
   - **IGNORE any block that already curls a script.** If a block fetches a `.sh` over `curl` and hands it to `bash` (the `s=$(curl ...) && bash -c "$s"` shape), it is ALREADY migrated. It is NOT a candidate. Re-extracting it would loop forever.
   - This applies to EVERY such block, including ones that are only documentation or guidelines demonstrating the curl-and-run syntax (e.g. a CRON snippet example). Never extract those either.
   - Rule of thumb: extract blocks that CONTAIN a script. Skip blocks that POINT AT a script.

3a. if there IS a code snippet to extract:

    - spin up a sub-agent and execute this:

    ```
    Execute this task: "REUSABLE-PROMPT-3-EXTRACT-ONE-SH-SNIPPET.md" for this file: path/to/prompt.md and migrate "<CODE>" code block starting on line:66
    ```

    - When sub-agent job completes, RECORD the path of the .sh file it just created (the sub-agent reports this path back to you). Keep a running list across the whole loop.

    - Then loop back to step 1 and scan the entire prompt again

3b. Ff there is NO code snippet to extract, move on to below steps

4. Run unit tests to validate, just for a sanity check
   -> <projectDir>/unit-tests.sh
   -> Ignore unrelated pre-existing failures, we only care about this new prompt.md file

5. Script improvement pass - for EVERY .sh path you recorded in step 3a, spin up a sub-agent

```
Execute this task: resources/2-REUSABLE-PROMPT-IMPROVE-A-SCRIPT.md
For this file: /path/to/scripts/foobar-script.sh
```

-> Pass the EXTRACTED SCRIPT path (.sh), NOT the prompt.md path. This prompt reads and rewrites a shell script, so handing it a markdown file will not work.
-> One sub-agent per extracted script. These are independent, so they can run in parallel.
-> If step 3a recorded nothing (no extractions happened), SKIP this step entirely.

6. These agents edited the scripts in place, so re-run the step 4 unit tests, then report success
