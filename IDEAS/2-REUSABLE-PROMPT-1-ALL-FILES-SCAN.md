## HUMAN-TODO

store this prompt in resources/REUSABLE-PROMPT-1-ALL-FILES-SCAN.md
-> ~/workplace/SpenlepAgents/src/SpenlepAgents/resources/REUSABLE-PROMPT-1-ALL-FILES-SCAN.md

## Steps

1. Scan this directory to generate a list of \*.md files in commands/ folder

- commands/\*.md

2. For every file, spin up a sub-agent and execute this task:

   ```
   Execute this task: "~/workplace/SpenlepAgents/src/SpenlepAgents/resources/REUSABLE-PROMPT-2-ONE-FILE-EXTRACTION.md" for this file: path/to/prompt.md and migrate "<CODE>" code block starting on line:66
   ```

3. When all sub-agents are complete, close this out and report success
