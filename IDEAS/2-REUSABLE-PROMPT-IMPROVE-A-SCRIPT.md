## HUMAN-TODO

-> Store this prompt in resources/2-REUSABLE-PROMPT-IMPROVE-A-SCRIPT.md
-> ~/workplace/SpenlepAgents/src/SpenlepAgents/resources/2-REUSABLE-PROMPT-IMPROVE-A-SCRIPT.md

## Input

1. "File path": "path/to/script/script.sh"
   -> The human will provide a single code script file path

## Background

I wrote scripts for my AI agents to execute. These are one-off and scope scripts used at runtime. They do one specific task really well.

I drafted all the prompts and they are working great. This is very important, some of the scripts are fragile and I can't break them, it's used in production.

However, I can do some additive changes and improve these scripts in-place.

We're revisiting these v1 scripts and seeing if there are any gaps/improvements potentially.

## Guidelines

- Do not refactor existing legacy code, maintain all the existing business logic
- Remember, these scripts must be able to run on Amazon Linux AND MacOS machines (agnostic), ideally built-in commands
- Do not rename files at all, keep exact same file path

## Task

THe user has provided us a specific script to analyze. We'll read it and preform the following improvements (if applicable):

1. Adding inline try/catch block for sections, so we can echo report a detail error

2. Printing the status result, at the very end of the file, it should report SUCCESS|FAILED status like so:

```
echo [SUCCESS]
# or
echo [FAILED]
echo "Ran into a runtime error, please download the script and debug it manually"
# ^ use this exact generic error message for the end piece
```

3. Inline code comments
   -> no code changes needed for this part
   -> review existing code, add concise inline code comments and JSDoc comments
   -> these comments help the AI Agent understand this code, and will make long-term maintenance easier

4. Retries
   -> Where we do network requests, can we make the script more robust?
   -> If possible, add retry logic, hard-coded to "3 attempts"

5. Logic Robustness
   -> Without major refactors, are they any ways to make this script more ROBUST, like edge-cases, error handling/log?
   -> Most of these script we're implemented just for happy-path, I don't know if they have good guard rails

## Output

N/A, once the code is written we can silently close this task.
