---
title: Component inventory
description: The component states the fixture inventory checks, shown with the fixture's demo data.
layout: doc
permalink: /inventory/
---

The inventory-only page for component states that the gallery does not show. It is built by the
fixture and checked by `test/visual/inventory.test.ts`; it is not part of the screenshot matrix.

## badge

:badge[New]{variant=note}

:badge[Watch]{variant=warning}

## backdrop

::backdrop{variant=grid}

<div data-fixture="backdrop-none"></div>

## bar-chart

::bar-chart{from=bar-chart category=quarter value=users direction=vertical title="Users by quarter"}

## changelog-entry

:::changelog-entry{version="1.3.0" date="2026-11-09" categories="added,changed,fixed,removed,security"}
- Add the inventory page.
:::

:::changelog-entry{version="9.9.9" date="2026-11-09" categories="added"}
:::

## cta-band

::cta-band{title="Component inventory" label="Home" url="/"}

## endpoint

:::endpoint{method=put path="/users/{id}" parameters='[{"name":"id","type":"uuid","required":true,"description":"The user id."}]'}
:::

:::endpoint{method=patch path="/users/{id}" parameters='[{"name":"id","type":"uuid","required":true,"description":"The user id."}]'}
:::

:::endpoint{method=delete path="/users/{id}" parameters='[{"name":"id","type":"uuid","required":true,"description":"The user id."}]'}
:::

## figure

::figure{src="/assets/gallery.svg" alt="A blue circle and a rectangle"}

## hero

:::hero{align=split eyebrow="Feature" title="Component inventory" lead="The states the fixture inventory checks."}
<div class="inventory-hero-visual">Sailcloth specimen</div>
:::

## link-card

::link-card{href="/inventory/" title="Component inventory"}

## motif

::motif{seed="inventory" pattern="dots"}

::motif{seed="inventory" pattern="grid"}

## output-block

:::output-block{label="Empty output"}
:::

## page-status

::page-status{status=experimental since="0.3"}

::page-status{status=beta since="0.3"}

## reading-time

::reading-time{minutes=3 words=600}

## status-banner

::status-banner{status=experimental}

::status-banner{status=old-version version="0.2.0"}

## status

:status[Archived]{tone=neutral} :status[Info]{tone=info}

## tested-chip

::tested-chip{passed=1 failed=0 total=2 lastPassed=2026-11-09}

::tested-chip{passed=0 failed=0 total=2 lastPassed=2026-11-09}

::tested-chip{passed=many failed=0 lastPassed=2026-11-09}

## trust-panel

:::trust-panel{level=partial reasons="One example passed."}
:::

:::trust-panel{level=unknown}
:::

## version-badge

::version-badge{version=0.3 variant=removed}

::version-badge{version=0.3 variant=purple}

## version-diff

:::version-diff{from="v1" to="v2" changes='[]'}
:::

:::version-diff{from="v1" to="v2" changes='[{"kind":"added","title":"Retries"},{"kind":"unreadable"}]'}
:::

:::version-diff{data='{"from":"v1","to":"v2","changes":"unreadable"}'}
:::

## record-history

<section class="record-history" data-fixture="record-history">
  <h2>Record history</h2>
  <nav class="record-history-filters" aria-label="Filter by field"><a class="record-history-filter" href="?history-field=" data-history-link data-history-value="">All fields</a><a class="record-history-filter" href="?history-field=pages" data-history-link data-history-value="pages">pages</a></nav>
  <ol class="record-history-events">
    <li class="record-history-event">
      <time class="record-history-date" datetime="2026-11-09">November 9, 2026</time>
      <span class="record-history-type">Changed</span>
      <span class="record-history-field">pages</span>
      <span class="record-history-change">120</span>
    </li>
  </ol>
</section>

## stale-notice

<aside class="stale-notice" role="note">
  <p class="stale-notice-reviewed">Reviewed November 9, 2026.</p>
  <ul class="stale-notice-files"><li class="stale-notice-file"><code>_data/books.json</code> changed</li></ul>
</aside>
