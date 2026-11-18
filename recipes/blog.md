# Recipe: turn a site into a blog

Mizzen plans the blog routes from Markdown posts; Lateen renders them with the `post` and `list`
layouts. No extra package or build step is needed beyond the theme.

## 1. Install

```bash
npm install @velella/mizzen @velella/lateen
```

Name the theme in `site/mizzen.yml`:

```yaml
title: My blog
url: https://example.com
theme:
  name: "@velella/lateen"
```

`url` is required for the feed: a site without a valid URL writes no `feed.xml`.

## 2. Add the blog block

```yaml
blog:
  posts: posts
  route: blog
  archive: archive
  authors: true
  feed: true
  pageSize: 10
```

## 3. Add the authors

```bash
mkdir -p _data posts
```

```yaml
# _data/authors.yml
ada:
  name: Ada Lovelace
  bio: Writes about engines.
```

## 4. Add a post

```markdown
---
title: A newer post
date: 2026-03-10
author: ada
slug: newer
description: The newest post.
---

The post body.
```

A draft sets `draft: true`; it gets no page, no archive entry, no author entry, and no feed entry.
The date must be a real `YYYY-MM-DD` calendar date, and the author must exist in `_data/authors.yml`.

## 5. Build

```bash
npx mizzen build site
npx mizzen check site --theme .
```

The output has:

```
blog/newer/index.html
blog/archive/index.html
blog/authors/ada/index.html
blog/feed.xml
```

A site with `base: /docs` writes the same files but every link in the HTML starts with `/docs`.

The full contract and options are on [the blog layout page](/layouts/post/).
