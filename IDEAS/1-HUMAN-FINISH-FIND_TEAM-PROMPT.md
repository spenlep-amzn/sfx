Create "commands/find-team.md"

## INPUT

One or more of the following:

1. Employee alias: @myalias (only a-z lowercase letters)
2. Package:

- Name: MyFoobarPackage
- Link: https://code.amazon.com/TODO/MyFoobarPackage

3. Pipeline Link: https://pipelines.amazon.com/TODO/MyFoobarPipeline

## GOAL

The user provides us with a specific person or resource, and our job is to identify the exact team they fall under.

Each map will map to one specific team. At minumum, we will find Team Name.
We will _attempt_ to find more links and resources on top of that.

## Amazon Context

Here at Amazon, every single team contains roughly 12 people known as a two-pizza team. 1 Software Developer Manager (SDM), and ~11 Software Dev Engineer (SDE) Individual Contributors. They own a feature/product, which consists of 5-20 git repositories (known as "Packages"), and 1-10 CI/CD pipelines. Typically, each team has a single Wiki page, which includes sub-links to their public slack channel, oncall schedule, and sometimes their Resolver CTI.

A Resolver Group / CTI is a single TeamId that allows us to route support tickets to this specific team. The only thing that is specific to each team if [RESOLVER ID]. It follows this pattern:

```
AWS -> Amazon Connect -> [RESOLVER ID]
AWS -> Amazon Connect -> Chat Frontend
AWS -> Amazon Connect -> Mission Control Frontend
```

For Oncall Schedule, teams can have 2. A primary oncall, and a secondary oncall

Within Amazon, I work for the "Amazon Connect" organization, code name "Lily". All teams have a one or two word name, like "Blitz team". We prefix the team name by organization, so our official internal team name is "Lily-Blitz"

There are 50+ teams in Connect, and many employees.

Team names like:

```
Lily-Chat
Lily-Blitz
Lily-Realtime
Lily-Wisdom
Lily-Torii
```

## Sources

You will use the built-in internal BuilderMCP to search the internal Amazon platform, mostly internal websites and wikis.

1.Example team wiki link: TODO/LilyChat (different formats, but here's a rough sample)

2. Connect Ownership Wiki: TODO
   -> this page can be stale/out-dated, don't take it as the source of truth

3. PhoneTool?? [TODO]

4. more?? [TODO]

## Guidelines

- Do not search extensively for the CTI/Resolver Group. That's typically difficult to find and ambiguous. There might be matches, but it's hard to know if it's stale or not.
- Only report sources of truth that you found, for missing information just report: [MISSING]

## STEPS / CHECKLIST

It doesn't have to be in this EXACT order, but this lays out a sequential plan and trusted sources for all the relevant data.

---

0. If we we're given employee alias: Check the job title,

SDM(Software Development Manager),FEE(Front End Engineer),SDE(Software Developer Engineer) are fine. Otherwise, quit this script and stop. We only care about Individual Contributors (IC) and their direct managers. Middle management and leadership aren't on specific teams, we won't be able to map them to a team.

1a. If we we're given an employee alias [TODO]
-> map this employ to an example BINDLE/POSIX/RESOLVER_GROUP
-> example: "lily-blitz", LilyBlitz, or Lily-Blitz
-> example: "team-name", TeamName, or Team-Name

1b. If we we're given a pipeline name [TODO]
-> find the BINDLE this pipeline is assigned to
-> TODO, where to go from there

1c. If we we're given a package name [TODO]
-> find the BINDLE or owner of this package in "permissions" page
-> it usually lists the MANAGER who owns this package
-> from there, we can map to a BINDLE/POSIX/RESOLVER_GROUP

2. Now that we have the team name, we can try to find other resources that fall under this name

3. Skim the Ownership wiki, try to match this with "Team Name" title case
   -> if no matches hit, skip to next step
   -> example: "Lily Blitz"

4. Try to find the team wiki
   -> example: "https://wiki.amazon.com/bin/LilyBiltz/TODO

5. Fetch the Wiki content
   -> See if we can extract the follow team-specific links:
   - Oncall schedule link
   - Slack channel link
   - CTI

## OUTPUT

Output this exact type of snippet:

```
Team name: Lily-TeamName
Wiki Link: https://TODO/link (if found)
Oncall Schedule: https://TODO/link (if found)
Secondary Oncall Schedule: <LINK> (if applicable)
Slack Channel: https://archive.slack/channel/TODO/link (if found)
Manager: @examplealias
CTI: `VALUE -> VALUE -> VALUE`
```
