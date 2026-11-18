---
title: Report issue
description: A prefilled link that opens an issue on the site's repository, with the page title, address, source, language and version already in it.
layout: doc
permalink: /components/report-issue/
---

The footer of every article can carry “Report a problem with this page”. The link opens a new issue
on the site's repository with the page details filled in; nothing is sent from the browser, and the
reader submits the issue themselves. A record page names the collection, the record id, and the line
in the data file instead of the page source.

It is a plain link: it works with no JavaScript and needs no island.

## Options

| Option | What it does |
| --- | --- |
| `repository.url` | The repository the issue is opened on. GitHub and GitLab hosts get the prefilled issue URL. Without it, `theme.options.reportIssue.url` must supply a tracker. |
| `repository.branch` | The branch the source link in the issue body points at. |
| `theme.options.reportIssue` | The whole block. `false` turns the link off. |
| `theme.options.reportIssue.template` | The issue template name the forge adds to the new-issue URL. |
| `theme.options.reportIssue.labels` | Labels to request on the new issue, as a list of names. |
| `theme.options.reportIssue.titlePrefix` | Text placed before the issue title, such as a project or team name. |
| `theme.options.reportIssue.url` | A template for a tracker other than GitHub or GitLab. It may use `{title}`, `{body}`, `{url}`, `{source}`, `{lang}`, and `{version}`. |

A value the link cannot read is left out; an empty repository and no template means no link, never a
link to nowhere.

## Live example

This page has the link in its footer. It opens the documentation repository's issue form with this
page's title, address and source file already filled in.

## Without JavaScript

The link is server-rendered and complete. No dialog, button, or status region is added by a script,
so the reader sees the same link whether JavaScript runs or not.

## Accessibility

The link is an ordinary link that opens in a new window when the tracker is external; its accessible
name says what it reports. It is hidden on paper, and the forced-colors palette keeps it as a system
link.
