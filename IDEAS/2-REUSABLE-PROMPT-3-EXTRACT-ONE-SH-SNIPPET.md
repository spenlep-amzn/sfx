## HUMAN-TODO

- Finish all remaining TODO items, fill in the details
- Run this script again and again to migrate ALL files incrementally
- Upload a dummy script.sh to remote package from previous step
  -> local file: `.claude/scripts/test-script.sh`
  -> remote link format: `https://code.amazon.com/package/PackageName/--/.claude/scripts/test-script.sh?raw.js` TODO
  -> Give the bot this link sample to do sanity check and make sure these instructions are usable/accurate

-> Finalize this prompt, then store it in resources/REUSABLE-PROMPT-3-EXTRACT-ONE-SH-SNIPPET.md
-> ~/workplace/SpenlepAgents/src/SpenlepAgents/resources/REUSABLE-PROMPT-3-EXTRACT-ONE-SH-SNIPPET.md

## Input

1. "File path": "path/to/commands/prompt.md"
   -> The caller provides a single markdown prompt.md file path

2. "Target code block": the ONE specific code block to migrate
   -> Identified by its starting line number (e.g. `line:66`), and/or the first line of its content
   -> The caller ALWAYS provides this. It is not optional.

**Do NOT search the file for extraction candidates.** The caller already did that. Migrate exactly the block you were handed and nothing else. If the target block cannot be found at the given location, STOP and report the mismatch instead of picking a different block.

## Role

This prompt is used help me refactor an existing prompt file. It makes one single change to lift & shift the ONE code block it was given, extracting that inline script to it's own stand-alone file.

The file might have MANY inlines, but this prompt only ever touches the one it was handed. The caller loops to cover the rest.

## Proposed Feature

In the v1 implementation, I wrote huge prompt.md file with inline script.sh code snippets. The AI agent could generate the files at runtime and execute it. This took a LOT of tokens in the LLM conversation, which all cost money (and higher latency).

We're migrating to the v2 implementation, with light-weight prompt.md files that are importing standalone script.sh files, without reading the actual file content. This decouples the two as well.

New project structure:

```
.claude/
  |_ commands/*.md
  |_ scripts/*.sh|js|py
```

## Guideline

- always prefer .sh scripts (that are able to run on macOS OR Linux with built-in tools)
- don't rewrite or edit the script itself, just extract it byte identical

## Thoughts / Context

Code Comments Note: when we first implemented these scripts, it was directly inline and this could bloat the context window for an AI Agents prompt.md file, costing more money too. Now that we have EXTRACTED them to a script file, the AI Agent never see the file content. That reduces the asci characters created in the LLM conversation (saving money!!). This means we can write more characters in the extracted scripts if desired, whether it's code or code comments. Obviously, during this lift & shift we won't need to rewrite the scripts though, I'm just explaining the door that this opens up.

### Script Output

This is a critical feature to keep in mind. It's safe to make edits related to this, since it should be additive. Some script might already handle this echo logic, but we should audit it just to be sure.

There are two scenarios:

1. A script runs and silently exits on success, doesn't output any information/results

   -> No changes needed to the script, we'll just expect it to

2. A script is querying something and needs to output/report the full result

   -> We might need to make small adjustment to the script, so it successfully reports the output even if we just use Bash(<path/to/script.sh>)
   -> For ANY data that may need to get outputted, make sure it's PRINTING this via "echo "something" statement.
   -> The AI agent won't see the source code, but will be able to see the echo statements

2a. echo statements for small/chunks

2b. for large outputs, pipe it to a file like "[randomId]-output.txt"
-> then, this script can simply report the absolute `/path/to/[randomId]-output.txt`
-> the AI agent will just see the file path outputted, but it will be smart enough to read it

## Steps / Checklist

1. Open the provided prompt.md and go straight to the target code block at the line number you were given. Confirm it matches what the caller described. Do not scan the rest of the file.

2. Lift & shift this entire code block (exactly as written) into a file: scripts/foobar-script.sh

3. Replace the inline code snippet with this type of message:

<markdown-after>
Invoke the script with Bash() tool:

```
s=$(curl -fsSL --max-time 20 --cookie ~/.midway/cookie https://code.amazon.com/TODO/path/to/file/foobar-script.sh) && bash -c "$s"
```

</markdown-after>

Note: notice how it uses this very specific syntax: `[SCRIPT] <link-to-script>`, and mentions the exact file name.

4. Done! It's extracted and wired together

## Output

Report "success", AND report the path of the .sh file you created. Keep it short:

```
success
script: .claude/scripts/foobar-script.sh
```

The calling agent needs this path so it can run a follow-up improvement pass on the extracted script.
