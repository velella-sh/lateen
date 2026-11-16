# Report issue

A "Report a problem with this page" link that opens a new issue on the site's GitHub or GitLab repository, with
the page title, address, source file, language and version filled in. It is a plain link: nothing is sent from
the page. The unit renders nothing when the site names no repository, the host is not supported, or the unit is
off. Host detection and the issue URL come from `src/repository.ts`, shared with `edit-page`.

Placing the link in each layout's footer is a separate step; the unit is not yet placed by a layout.

## Options

```yaml
theme:
  options:
    reportIssue:
      template: bug_report.md   # issue template name
      labels: [docs, feedback]  # GitHub only
      titlePrefix: "[docs]"
      url: https://tracker.example/new?title={title}&body={body}
```

- `template`: GitHub `template=`, GitLab `issuable_template=`.
- `labels`: GitHub `labels=`; GitLab's new-issue URL takes no label names, so they are left out there.
- `titlePrefix`: put before the page title.
- `url`: for trackers other than GitHub and GitLab. Placeholders `{title}`, `{body}`, `{url}`, `{source}`,
  `{lang}`, `{version}` are filled in one pass with URL-encoded values. A template that is not `https` is not linked.
  It takes precedence over `repository`.
- `false` turns the unit off.
