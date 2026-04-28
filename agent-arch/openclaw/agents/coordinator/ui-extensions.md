---
title: "GitHub Dashboard"
requires:
  - git_pat
apis:
  milestones:
    url: https://api.github.com/repos/${GIT_REPO}/milestones?state=all&per_page=30
    auth: ${GIT_PAT}
    refresh: 120
  issues:
    url: https://api.github.com/repos/${GIT_REPO}/issues?state=open&per_page=30
    auth: ${GIT_PAT}
    refresh: 120
  pulls:
    url: https://api.github.com/repos/${GIT_REPO}/pulls?state=open&per_page=30
    auth: ${GIT_PAT}
    refresh: 120
---

<!--
================================================================================
HOW TO EDIT THIS FILE
================================================================================
This file IS the UI tab. Edit it freely; changes propagate within ~10 s.

Frontmatter:
  title:    Tab label in the dashboard navbar.
  requires: Credentials the dashboard needs. The tab is hidden until every
            entry resolves. Built-in tokens:
              git_pat       — coordinator's PAT must be set (Git tab)
              git_repo      — coordinator's repo URL must be set
              <ANY_VAR>     — any env var or ui_secrets.json key
  apis:     Per-API definition for live external data. URL and `auth` may
            reference ${VAR} tokens. Magic tokens:
              ${GIT_PAT}      → coordinator's PAT (Bearer-token, server-side)
              ${GIT_REPO}     → owner/repo slug from coordinator's repo URL
              ${GIT_REPO_URL} → full repo URL
            All other ${VARS} resolve from env or ui_secrets.json.

Body tokens:
  {{progress:open:closed[:label]}}                — green progress bar + stats line
  {{apitable:api_key:col1,col2,...[:Heading]}}    — render API JSON array as a table.
                                                    When a row has open_issues +
                                                    closed_issues numeric fields, a
                                                    thin progress bar appears under
                                                    the title cell. Optional Heading
                                                    renders as "Heading (N)" above
                                                    the table.
  {{apilist:api_key:field[:Heading]}}             — render API JSON array as a bullet
                                                    list. Optional Heading renders
                                                    as "Heading (N)" above the list.

Both apitable and apilist auto-prepend `#NNN` (from row.number) to titles when
present, and append a small ↗ link (from row.html_url) for opening the item
on its source. Works for any GitHub resource (issues, PRs, milestones, etc.).

The renderer is a skeleton. Markdown headings, paragraphs, lists, <hr> and
the tokens above determine the entire visual flow — no card-wrap is added.
================================================================================
-->

{{apitable:milestones:title,open_issues,closed_issues,due_on:Milestones}}

{{apilist:issues:title:Open Issues}}

{{apilist:pulls:title:Open Pull Requests}}
