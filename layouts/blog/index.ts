import type { Page, Site } from "@velella/mizzen/contracts";

/** One public post, as the engine's blog front matter carries it. */
export interface BlogPost {
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly url: string;
  readonly description?: string;
}

function mapping(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

/** The blog block of a page, or undefined when the page is not a blog page. */
export function blogOf(page: Page): Readonly<Record<string, unknown>> | undefined {
  return mapping(page.frontMatter.blog);
}

/** The kind of blog page: `post`, `archive`, or `author`. */
export function blogKindOf(page: Page): "post" | "archive" | "author" | undefined {
  const kind = blogOf(page)?.kind;
  return kind === "post" || kind === "archive" || kind === "author" ? kind : undefined;
}

/** A string value with content, or undefined. */
function stringOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** The posts a blog page lists, dropping entries the engine shape does not match. */
export function postsOf(page: Page): BlogPost[] {
  const posts = blogOf(page)?.posts;
  if (!Array.isArray(posts)) return [];
  return posts.flatMap((entry) => {
    const post = mapping(entry);
    const title = stringOf(post?.title);
    const date = stringOf(post?.date);
    const author = stringOf(post?.author);
    const url = stringOf(post?.url);
    if (post === undefined || title === undefined || date === undefined || author === undefined || url === undefined) {
      return [];
    }
    const description = stringOf(post.description);
    return [{ title, date, author, url, ...(description === undefined ? {} : { description }) }];
  });
}

/** The author record an author page carries, or undefined on every other page. */
export function blogAuthorOf(page: Page): Readonly<Record<string, unknown>> | undefined {
  return mapping(blogOf(page)?.author);
}

/** An author record from `_data/authors.yml` by id. */
export function authorOf(site: Site, id: string): Readonly<Record<string, unknown>> | undefined {
  return mapping(mapping(site.data.authors)?.[id]);
}

/** The author's display name: the record's `name`, else the id the post wrote. */
export function authorNameOf(site: Site, id: string): string {
  return stringOf(authorOf(site, id)?.name) ?? id;
}

/** The page that lists a post's author, when the site publishes one. */
export function authorPageOf(site: Site, id: string): Page | undefined {
  return site.pages.find((page) => {
    if (blogKindOf(page) !== "author") return false;
    return mapping(blogOf(page)?.author)?.id === id;
  });
}

/** The archive URL: the configured route under the site's base, never the build's output folder. */
export function archiveUrlOf(site: Site): string {
  const base = site.config.base;
  const route = (site.config.blog?.route ?? "blog").replace(/^\/+|\/+$/g, "");
  const name = (site.config.blog?.archive ?? "archive").replace(/^\/+|\/+$/g, "");
  return `${base}/${route}/${name}/`;
}
