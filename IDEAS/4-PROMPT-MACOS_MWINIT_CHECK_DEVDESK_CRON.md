## Background

I have two laptops:

1. Local machine, macos laptop
2. Remote machine, amazon linux virtual desktop

On the remote machine, it uses "Midway" credentials to access other internal systems.
Step 1: ssh to log in to the remote machine linux OS
Step 2: generate midway credentials to unlocks access to tools and internal websites

I have "Midway" auth credentials that need to manually refreshed, and last up to 20 hours.

It's annoying to manually open my dev desktop and remember to refresh the credentials.

We can automate some of this with a local script though!!

My local machine has an SSH key that doesn't expire, so I don't lose access. It's possible to ssh into the remote machine WHENEVER, thats the easy part. The remote machine is useless though unless it has Midway credentials though. That's the key area I'm worried about.

Currently, i need to manually open the machine and remember to refresh creds. It's all trivial information though, and I have have scripts to scan it for me.

## Goal / Context

My goal is to build a stand-alone script that can check the STATUS of my remote credentials. It can't refresh or take any action on it, but it can report the status.

The script will ONLY run on my local mac os machine.
It will need to ssh into the linux remote machine, run a command to check the creds (how much longer until it expires), and report the status.

Ideally, I need a robust way to report VALID|EXPIRED.
status, and additionally REMAINING_TIME if possible.
Bare bones, I need VALID|EXPIRED status.
If we can report a simple TIMESTAMP or REMAINING_TIME (HH:MM), that would be an amazing additional field.

If the credentials are valid
-> no action needed, silently close.

If the credentials are expired
-> launch a terminal popup on the local machine

If the credentiails are within 4 hours of expiring:
-> launch a terminal popup on the local machine

## Steps / Task

1. Write the script that runs in the remote machine

```sh
check_remote_mwinit() {
  # Make sure we are on Darwin MacOs platform
  [[ "$(uname -s)" != "Darwin" ]] && return 0

  local SSH_HOST="user@host"
  local CHECK_CURRENT_MWINIT_CREDS="mwinit -l && print $NOW && isCookieNearExpiring()"
  local REFRESH_CREDS_COMMAND="mwinit -o"
  # Command typed into the new Terminal window (remote command is single-quoted so AppleScript needs no extra escaping)
  local REFRESH_TERMINAL_CMD="ssh $SSH_HOST '$REFRESH_CREDS_COMMAND' || echo FAILED"

  # Fetching the status (TODO-FINALZE)
  # out = remote stdout+stderr (plus any local ssh errors), rc = remote exit code (255 = ssh itself failed)
  # (declared separately from the assignment so `local` doesn't clobber $?)
  local out rc
  out=$(ssh "$SSH_HOST" "$CHECK_CURRENT_MWINIT_CREDS" 2>&1)
  rc=$?

  # Branching logic -
  if [[ $rc -eq 255 ]]; then
    # Could not reach the remote machine at all
    echo "ssh failed: $out" >&2
    return 1
  elif [[ $rc -ne 0 ]] || grep -qi 'expired' <<<"$out"; then
    # If credentials are expired
    osascript -e 'tell application "Terminal" to activate' -e "tell application \"Terminal\" to do script \"$REFRESH_TERMINAL_CMD\""
  else
    # If credentials are within 4 hours of expiratio [TODO-NEED-TO-INVESTIGATE]
    # TODO: parse the expiry timestamp out of "$out", then compare against $(date +%s)
    # osascript -e 'tell application "Terminal" to activate' -e "tell application \"Terminal\" to do script \"$REFRESH_TERMINAL_CMD\""
    :
  fi
}

```

2. Do e2e testing to make sure it works and reports VALID

Note, we can't do an e2e test for expired yet, I'll have to do that manually

3. Try to implement TIMESTAMP branching
   -> before doing the remote logic, we can check this already since we have this exact midway cookie on our local machine too,` ~/.midway/cookie/TODO`. Test out how we can easily calculate the remaining time.
   -> this is actually straight forward to implement. Only the remote machine needs to know the TIMESTAMP. It calculates the remaining time and just reports EXPIRED when its under 4 hours threshold. So "EXPIRED" even before it actually is.
   -> local machine does need the second "if" block.
   -> Do some e2e testing to see how to correctly calculate remaining threshold in the one liner: `local CHECK_CURRENT_MWINIT_CREDS="mwinit -l"`
   -> Then, update "CHECK_CURRENT_MWINIT_CREDS" to handle remaing time now when you have a working command

4. Add the final script to zshCommon.sh

5. Add the entry for the cron job in zshCommon.sh, calling that script we just created

## Output

Add an entry near the bottom of this file: zshCommon.sh

1. a function that executes the actual check: check_remote_mwinit()
2. a function that mounts/demounts the idempotent cron job and executes "check_remote_mwinit" -> "mount_cron_check_remote_mwinit"
   -> there's already an example CRON job in zshCommon.sh, currently comment out
   -> keep that existing one commented out, but re-use some of that boilerplate if that helps
3. Add "mount_cron_check_remote_mwinit" line below existing check_mwint
