---
title: Blog layout
description: The post layout and the blog routes Mizzen builds from Markdown posts.
layout: doc
permalink: /layouts/post/
---

The `post` layout renders one blog post. The engine owns the routes: it reads Markdown files under
`blog.posts`, builds a page per public post, an archive, one page per author, and a feed. The theme
only renders the pages the engine plans.

## Turn the blog on

Add a `blog` block to the site config:

```yaml
blog:
  posts: posts          # folder under the site root
  route: blog           # public prefix; default blog
  archive: archive      # archive route under the prefix; default archive
  authors: true         # one page per author; default true
  feed: true            # /blog/feed.xml; default true
  pageSize: 10
```

With that block and a valid `url`, a build writes:

| URL | What it is |
| --- | --- |
| `/blog/<slug>/` | One public post. A post that sets no `layout` gets `post`. |
| `/blog/archive/` | Every public post, newest first, rendered by the `list` layout. |
| `/blog/authors/<id>/` | One author's posts, rendered by the `list` layout. |
| `/blog/feed.xml` | An Atom feed, newest first. |

The archive is the blog's list page: the engine writes no `/blog/` index.

## Write a post

A post is a Markdown file under `blog.posts` with this front matter:

```yaml
---
title: A newer post
date: 2026-03-10
author: ada
slug: newer
description: Shown on the post, the archive, and the feed.
draft: false
---
```

- `date` is a real calendar date written `YYYY-MM-DD`; a missing or invalid date is a build error.
- `author` is an id in `_data/authors.yml`. Each entry needs a `name`.
- `slug` is one URL segment. Without it the file name is the slug.
- `draft: true` keeps the post out of every public route and the feed.
- `description` is optional.

```yaml
# _data/authors.yml
ada:
  name: Ada Lovelace
  bio: Writes about engines and the people who build them.
  url: https://example.org/ada/
  avatar: /images/ada.jpg
  avatarAlt: Portrait of Ada Lovelace
```

Posts sort newest first. Two posts on the same date sort by slug, so a rebuild keeps the same order.

## What the layout renders

The post page uses the docs shell: header, navigation sidebar, the on-this-page column, and the
article. The article shows the title, the date as `<time datetime>`, the author's display name linked
to the author page, the author’s image or bio when available, the optional description, the body with highlighted code fences, and a link back
to the archive. A body that already starts with an `h1` keeps its own title and the layout adds none.

The archive and author pages use the `list` layout. When `page.frontMatter.blog` is present the layout
draws the posts as one list, with each title linked, its date, author, and description; it never draws
the records table. Above their posts, author pages show the author's name and optional `bio`, `url`,
and portrait. The portrait comes from `avatar` or `image`; use `avatarAlt` or `imageAlt` for its alt
text, which defaults to the author's name. A root-relative portrait path follows the site's base.

Every URL already carries the site's `base`, so a blog under `/docs` links `/docs/blog/...` without a
second prefix. Links are plain anchors, so they work without JavaScript and from the keyboard.

## Check it

```bash
npx mizzen check site --theme .
npx mizzen build site
```

The repository's blog fixture lives in `fixtures/blog/`, the setup steps are in `recipes/blog.md`,
and the end-to-end expectations are in `test/blog/acceptance.test.ts`.
