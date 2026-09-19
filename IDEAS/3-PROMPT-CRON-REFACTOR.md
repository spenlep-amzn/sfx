## Background / V1 Implementation

I built this always-on AI Agent that runs 24/7: commands/assistant.md

I uses built-in Claude code features to schedule CRON jobs and spin up sub-agents on a fixed schedule. With this prompt, it effectively orchestrates all sub-tasks and doesn't do anything beyond that.

Each sub-agent just maps directly to a single entry prompt, like "/commands/bot-scan-incoming-pull-requests.md"

**Usage**:

```bash
# invoke the /commands/assistant.md master agent prompt
claude "/assistant"
claude > scheduling all cron jobs
# invokes the sub-agent, for /commands/bot-scan-incoming-pull-requests.md
claude > launching sub-agent-1 to invoke "[COMMAND] /bot-scan-incoming-pull-requests"

# invokes the sub-agent, for /commands/bot-scan-outgoing-pull-requests.md
claude > launching sub-agent-2 to invoke "[COMMAND] /bot-scan-outgoing-pull-requests"

# ... more jobs
```

## Problem Statement

Launching the master orchestrator agent costs token and money. It's pointless because the orchestrator isn't doing ANYTHING beyond just schedule CRON jobs. It's very overkill to use an LLM just to schedule CRON jobs on my local machine. It just maps directly to one bot.md file anyways.

Another cumbersome task was part of this design was the "check-mwinit-prereq" prerequisite step or the "bot-scan-credentials". The agent was literally spinning up entire sub-agents JUST to check the credentials. The was so expensive and wasteful. The goal was to prevent us from running jobs if the creds were expired, because the CRON jobs would fast fail anyways.

A simpler solution would be to check credentials BEFORE launching the LLM at all, PER cron job. Everytime we attempt to run a cron now, it will check creds and gracefully exit if they are expired, before it even launches the claude sub-agent.

## Proposed Solution / V2 Implementation

I can delete "assistant.md" and move this entirely to raw script "zshCommon.sh". I wrote full boiler plate of all the business logic below in psuedo-code. For the low-level implementation of CRON too, that's available in a commented out snippet.

IMPORTANT: keep this syntax format: `[COMMAND] /my-command-name`. The unit tests use this to grep search. This is how we validate the file name exists and matches, so we don't accidentally rename and break something.

## Implementation

### 1. Script

**Commands**

```
./zshCommon.sh

# This is a standalone initializing util, run it ANY time to init or refresh the cron jobs
# Handling crons mounted globally on this machine
mount-idempotent-cron(commandToRun, cronSetting) {
  # check if there's a job already mounted

  # if there is an existing job with stale cronSetting
    -> unmount the job
    -> continue the below steps

  # if there is an existing job with correct settings
    -> exit the script here, STOP

  # if no job
    -> mount a cron job
}

start-ass() {
  MODEL="sonnet"


  BOT_PROMPTS = (
    "/bot-scan-1", "10 * * *
    "/bot-scan-2",
    "/bot-scan-3",
  )

  FOR each [BOT_PROMPT, CRON_SETTING] in BOT_PROMPTS:
    # If the creds are valid, it prints ~/.midway/cookie, and we can calculate the expiration time (20hours max)
    # If the creds are within 1 hours of expiring, treat that as EXPIRED
    CHECK_CURRENT_MWINIT_CREDS="mwinit -l && print $NOW && isCookieNearExpiring()"

    LAUNCH_CLAUDE_HEADLESS_MODE="claude -p --max-budget-usd 10 --output-format json --dangerously-skip-permissions --model $MODEL '$BOT_PROMPT'"

    # check credentials before proceeding, if expired, EXIT gracefully on don't launch claude
    # If the credentials are expired, we can keep running the CRON jobs. They will ALL fail, but that's okay. The human might come in and refresh the creds on their own schedule, so it might self-recover, that's why we don't want to dismount any CRON jobs, that's a seperate concern.
    COMMAND_TO_RUN="CREDENTIALS_CHECK && LAUNCH_CLAUDE_HEADLESS_MODE"
    mount-idempotent-cron(COMMAND_TO_RUN, CRON_SETTING)
}

stop-ass() {
  # kill ALL cron scheduled CRON jobs

  # force kill ALL claude sessions proceeses
}

# One-liner, automatically launch the assistant on my remote desktop
[[ "$(uname -s)" == "Darwin" ]] && start-ass
```

**Usage**

- stop-ass
- start-ass

**Daily Workflow**
Launch dev-desk
Run mwinit
It mounts the CRONs in background upon launching .zshrc, by running "start-ass"
Human can optionally run stop-as to dismount, if they please

### 2. Unit Test Coverage

We need to add a test suite here: unit-tests.sh

I need to add test cases that dynamically search/regex/grep for the presence of "[COMMAND] /my-command-name" in the zshCommon.sh file. Then, we need to cross-reference and VALIDATE that a markdown file with this exact name lives in commands/ directory, expecting "/commands/my-command-name.md".

This should be pretty simple, we already built wiring for .md to .md files within commands/. Now we're just wiring together the commands to resources/zshCommon.sh, to enforce they import valid commands and don't drift.

Once you write this unit test, run the file to validate it passes. Don't worry about pre-existing tests if they fail, just focus on THIS test case.

## End-to-end Test / Success Criteria

1. Test the end-to-end functionality and status VALID|EXPIRED of the mwinit command
   -> make sure it's a concise one or two-liner command that handles <=1 hour til expiration too
   -> you can run all these on the local machine and fact check with the real cookie

2. Run the "mount-idempotent-cron" for a single job, make sure:
   -> 1. can mount a fresh CRON job
   -> 2. can re-mounts a CRON job with different cronSettings (changed)
   -> 3. Ignores for up-to-date cronSettings and existing job
   -> sample prompt to use: commands/bot-scan-incoming-crs.md
   -> I don't about about validating the workflow actually ran - the cron already handles that. I just want to make sure THIS script is properly mounting/dismounting them.

3. Run the "start-ass" script for end-to-end
   -> test to make sure it registers a CRON entry for every item in BOT_PROMPTS list

4. Cleanup: upon success, manually dismount all cron jobs on this machine. ALL.

IMPORTANT: do not run "stop-ass" command, that will kill THIS claude session too.
