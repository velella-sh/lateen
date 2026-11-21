CI runs the full suite once per main push: the `test` job measures coverage there and the `coverage`
job only publishes the badge, so main no longer runs the suite twice. The accessibility and smoke
jobs also stop rebuilding the UI a second time in a step that follows a build.
