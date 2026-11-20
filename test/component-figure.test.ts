import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import figure, {
  DARK_IMAGE_CLASS,
  FIGURE_CLASS,
  PAIR_CLASS,
  PAIRED_CLASS,
  creditHref,
  dimension,
  fullSizeHref,
  idBase,
  imageList,
  type FigureProps,
} from "../components/figure/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const namesPath = join(root, "tokens/names.json");

/** The parts of a preact VNode the assertions read. */
type Tree = { type: string; props: { children?: unknown; [key: string]: unknown } };
type Node = Tree | string | number | null | undefined | boolean;

function render(props: FigureProps, html = "") {
  return renderOn({} as ComponentProps["page"], props, html);
}

function renderOn(page: ComponentProps["page"], props: FigureProps, html = "") {
  const input = {
    props,
    html,
    page,
    site: {} as ComponentProps["site"],
  } as ComponentProps<FigureProps>;
  return figure(input) as unknown as Node;
}

/** Every element in the tree, depth first. */
function elements(node: Node): Tree[] {
  if (node === null || node === undefined || typeof node !== "object") return [];
  const out: Tree[] = [node as Tree];
  const children = node.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list as Node[]) out.push(...elements(child));
  return out;
}

function imagesOf(node: Node): Tree[] {
  return elements(node).filter((element) => element.type === "img");
}

function find(node: Node, className: string): Tree | undefined {
  return elements(node).find((element) => element.props.class === className);
}

function textOf(node: Node): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node === null || node === undefined || typeof node !== "object") return "";
  const children = node.props?.children;
  const list = Array.isArray(children) ? children : [children];
  return (list as Node[]).map(textOf).join("");
}

const css = ""; // lateen-legacy style sheet removed

/** Index of `child` among the figure's own children. */
function childIndex(tree: Tree, child: Node): number {
  const children = Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children];
  return children.indexOf(child);
}

test("default export is the figure component", () => {
  assert.equal(typeof figure, "function");
});

test("renders a figure with the image, lazy loading, and async decoding by default", () => {
  const tree = render({ src: "/a.png", alt: "A chart" }) as Tree;
  assert.equal(tree.type, "figure");
  assert.equal(tree.props.class, "figure");
  const [img] = imagesOf(tree);
  assert.equal(img?.props.src, "/a.png");
  assert.equal(img?.props.alt, "A chart");
  assert.equal(img?.props.loading, "lazy");
  assert.equal(img?.props.decoding, "async");
  assert.equal(img?.props.class, "figure-img");
});

test("a missing or blank src renders nothing", () => {
  assert.equal(render({}), null);
  assert.equal(render({ src: "   " }), null);
});

test("an authored id lands on the figure and stays as written", () => {
  const tree = render({ src: "/a.png", id: "pipeline" }) as Tree;
  assert.equal(tree.props.id, "pipeline");
});

test("an id is reduced to safe characters, and a blank or missing one emits no id", () => {
  assert.equal(idBase(" pipeline "), "pipeline");
  assert.equal(idBase("My Figure!"), "My-Figure");
  assert.equal(idBase("نسخه ۲"), "نسخه-۲");
  assert.equal(idBase("???"), "");
  assert.equal((render({ src: "/a.png", id: "  " }) as Tree).props.id, undefined);
  assert.equal((render({ src: "/a.png" }) as Tree).props.id, undefined);
});

test("two figures on one page never share an id", () => {
  const page = {} as ComponentProps["page"];
  const first = renderOn(page, { src: "/a.png", id: "pipeline" }) as Tree;
  const second = renderOn(page, { src: "/b.png", id: "pipeline" }) as Tree;
  assert.equal(first.props.id, "pipeline");
  assert.equal(second.props.id, "pipeline-2");
});

test("one page's ids do not leak into another page", () => {
  const first = render({ src: "/a.png", id: "pipeline" }) as Tree;
  const second = render({ src: "/b.png", id: "pipeline" }) as Tree;
  assert.equal(first.props.id, "pipeline");
  assert.equal(second.props.id, "pipeline");
});

test("a missing alt is empty, which marks the image as decorative", () => {
  const [img] = imagesOf(render({ src: "/a.png" }));
  assert.equal(img?.props.alt, "");
});

test("width and height are set on the image to reserve its space", () => {
  const [img] = imagesOf(render({ src: "/a.png", width: "640", height: "360" }));
  assert.equal(img?.props.width, 640);
  assert.equal(img?.props.height, 360);
});

test("a width or height that is not a whole number above zero is left off", () => {
  assert.equal(dimension("640"), 640);
  assert.equal(dimension(" 12 "), 12);
  assert.equal(dimension("0"), undefined);
  assert.equal(dimension("-3"), undefined);
  assert.equal(dimension("3.5"), undefined);
  assert.equal(dimension("auto"), undefined);
  assert.equal(dimension(undefined), undefined);
  const [img] = imagesOf(render({ src: "/a.png", width: "wide", height: "0" }));
  assert.equal(img?.props.width, undefined);
  assert.equal(img?.props.height, undefined);
});

test("loading and decoding accept their listed values and fall back otherwise", () => {
  const [eager] = imagesOf(render({ src: "/a.png", loading: "eager", decoding: "sync" }));
  assert.equal(eager?.props.loading, "eager");
  assert.equal(eager?.props.decoding, "sync");
  const [odd] = imagesOf(render({ src: "/a.png", loading: "soon", decoding: "later" }));
  assert.equal(odd?.props.loading, "lazy");
  assert.equal(odd?.props.decoding, "async");
});

test("srcset and sizes are passed to the image", () => {
  const [img] = imagesOf(render({ src: "/a.png", srcset: "/a-2x.png 2x", sizes: "50vw" }));
  assert.equal(img?.props.srcset, "/a-2x.png 2x");
  assert.equal(img?.props.sizes, "50vw");
});

test("with src_dark the figure carries both images inside one named wrapper", () => {
  const tree = render({ src: "/light.png", src_dark: "/dark.png", alt: "Diagram" }) as Tree;
  assert.equal(tree.props.class, "figure figure-paired");
  const pair = find(tree, PAIR_CLASS) as Tree;
  assert.equal(pair.type, "div");
  assert.equal(pair.props.role, "img");
  assert.equal(pair.props["aria-label"], "Diagram");
  const images = imagesOf(pair);
  assert.equal(images.length, 2);
  assert.equal(images[0]?.props.class, "figure-img figure-img-light");
  assert.equal(images[0]?.props.src, "/light.png");
  assert.equal(images[1]?.props.class, "figure-img figure-img-dark");
  assert.equal(images[1]?.props.src, "/dark.png");
  assert.equal(images[1]?.props.loading, "lazy");
});

test("a pair exposes its alternative once, on the wrapper, while both images are presentational", () => {
  const tree = render({ src: "/light.png", src_dark: "/dark.png", alt: "Diagram of the build" });
  const pair = find(tree, PAIR_CLASS) as Tree;
  const images = imagesOf(pair);
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.props.alt, "");
    assert.equal(image.props["aria-hidden"], "true");
  }
  const named = elements(tree).filter((element) => element.props["aria-label"] === "Diagram of the build");
  assert.equal(named.length, 1);
  assert.equal(named[0], pair);
});

test("a single figure keeps its image named and not hidden", () => {
  const tree = render({ src: "/a.png", alt: "A chart" });
  const [img] = imagesOf(tree);
  assert.equal(img?.props.alt, "A chart");
  assert.equal(img?.props["aria-hidden"], undefined);
  assert.equal(elements(tree).some((element) => element.props.class === DARK_IMAGE_CLASS), false);
});

test("a decorative pair keeps both images decorative, with no unnamed image wrapper", () => {
  const tree = render({ src: "/light.png", src_dark: "/dark.png" });
  const pair = find(tree, PAIR_CLASS) as Tree;
  assert.equal(pair.props.role, undefined);
  assert.equal(pair.props["aria-label"], undefined);
  const images = imagesOf(pair);
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.props.alt, "");
    assert.equal(image.props["aria-hidden"], "true");
    assert.ok(
      image.props.class === "figure-img figure-img-light" || image.props.class === DARK_IMAGE_CLASS,
      "both images keep their class",
    );
  }
});

test("the dark image gets the same size as the light one", () => {
  const images = imagesOf(render({ src: "/l.png", src_dark: "/d.png", width: "320", height: "200" }));
  for (const img of images) {
    assert.equal(img.props.width, 320);
    assert.equal(img.props.height, 200);
  }
});

test("src_dark equal to src, or blank, gives one image and no pair", () => {
  for (const src_dark of ["/a.png", "  "]) {
    const tree = render({ src: "/a.png", src_dark }) as Tree;
    assert.equal(tree.props.class, "figure");
    assert.equal(imagesOf(tree).length, 1);
  }
});

test("the caption is the caption prop", () => {
  const tree = render({ src: "/a.png", caption: "Figure 1: load over time" });
  const caption = find(tree, "figure-caption") as Tree;
  assert.equal(caption.type, "figcaption");
  assert.equal(textOf(find(tree, "figure-text")), "Figure 1: load over time");
});

test("without a caption prop the directive body is the caption, as HTML", () => {
  const tree = render({ src: "/a.png" }, "<p>Load over <em>time</em></p>");
  const text = find(tree, "figure-text") as Tree;
  assert.deepEqual(text.props.dangerouslySetInnerHTML, { __html: "<p>Load over <em>time</em></p>" });
});

test("the caption prop wins over the body", () => {
  const tree = render({ src: "/a.png", caption: "Prop" }, "<p>Body</p>");
  assert.equal(textOf(find(tree, "figure-text")), "Prop");
  assert.equal(find(tree, "figure-text")?.props.dangerouslySetInnerHTML, undefined);
});

test("no figcaption is rendered without a caption, a body, or a credit", () => {
  const tree = render({ src: "/a.png" }, "  ") as Tree;
  assert.equal(elements(tree).some((element) => element.type === "figcaption"), false);
});

test("a credit appears under the caption, linked only for web addresses", () => {
  const linked = render({ src: "/a.png", credit: "Ada", credit_url: "https://example.com/ada" });
  const anchor = elements(linked).find((element) => element.type === "a") as Tree;
  assert.equal(anchor.props.href, "https://example.com/ada");
  assert.equal(textOf(anchor), "Ada");

  const unsafe = render({ src: "/a.png", credit: "Ada", credit_url: "javascript:alert(1)" });
  assert.equal(elements(unsafe).some((element) => element.type === "a"), false);
  assert.equal(textOf(find(unsafe, "figure-credit")), "Ada");
});

test("the credit line appears only with a credit, and links a web source", () => {
  const none = render({ src: "/a.png", caption: "Figure 1" });
  assert.equal(find(none, "figure-credit"), undefined);

  const plain = render({ src: "/a.png", credit: "Ada" });
  const plainCredit = find(plain, "figure-credit") as Tree;
  assert.equal(textOf(plainCredit), "Ada");
  assert.equal(elements(plainCredit).some((element) => element.type === "a"), false);

  const linked = render({ src: "/a.png", credit: "Ada", credit_url: "https://example.com/ada" });
  const link = elements(find(linked, "figure-credit") as Tree).find((element) => element.type === "a") as Tree;
  assert.equal(link.props.href, "https://example.com/ada");
  assert.equal(link.props.rel, "noopener");
  assert.equal(textOf(link), "Ada");
});

test("creditHref accepts only http and https", () => {
  assert.equal(creditHref("https://example.com"), "https://example.com");
  assert.equal(creditHref(" HTTP://example.com "), "HTTP://example.com");
  assert.equal(creditHref("//example.com"), undefined);
  assert.equal(creditHref("data:text/html,x"), undefined);
  assert.equal(creditHref(undefined), undefined);
});

test("with href the image alone is a keyboard-focusable link to the full-size image", () => {
  const tree = render({
    src: "/a.png",
    alt: "A chart",
    caption: "Figure 1",
    credit: "Ada",
    href: "https://cdn.test/a-large.png",
  }) as Tree;
  const children = ownChildren(tree);
  assert.deepEqual(
    children.map((child) => (child as Tree).type),
    ["a", "figcaption"],
  );
  const anchor = children[0] as Tree;
  assert.equal(anchor.props.class, "figure-link");
  assert.equal(anchor.props.href, "https://cdn.test/a-large.png");
  assert.equal(anchor.props.tabindex, undefined);
  const [img] = imagesOf(anchor);
  assert.equal(img?.props.alt, "A chart");
  assert.equal(elements(anchor).some((element) => element.type === "figcaption"), false);
  assert.equal(textOf(children[1]), "Figure 1Ada");
});

test("a same-site href takes the site base", () => {
  assert.equal(fullSizeHref("/lateen", "/img/a-large.png"), "/lateen/img/a-large.png");
  const input = {
    props: { src: "/a.png", alt: "A", href: "/img/a-large.png" },
    html: "",
    page: {},
    site: { config: { base: "/lateen" } },
  } as unknown as ComponentProps<FigureProps>;
  assert.match(renderToString(figure(input) as never), /<a class="figure-link" href="\/lateen\/img\/a-large.png"><img/);
});

test("an unsafe or off-site href is ignored", () => {
  assert.equal(fullSizeHref("", "javascript:alert(1)"), undefined);
  assert.equal(fullSizeHref("", "http://cdn.test/a.png"), undefined);
  assert.equal(fullSizeHref("", "//cdn.test/a.png"), undefined);
  assert.equal(fullSizeHref("", "img/a.png"), undefined);
  assert.equal(fullSizeHref("", "  "), undefined);
  for (const href of ["javascript:alert(1)", "http://cdn.test/a.png", "//cdn.test/a.png", "data:image/png,x"]) {
    const tree = render({ src: "/a.png", alt: "A chart", href }) as Tree;
    assert.equal(elements(tree).some((element) => element.type === "a"), false);
    assert.equal((ownChildren(tree)[0] as Tree).type, "img");
  }
});

test("without href the image is not linked", () => {
  const tree = render({ src: "/a.png", alt: "A chart" }) as Tree;
  assert.equal(elements(tree).some((element) => element.type === "a"), false);
  assert.equal((ownChildren(tree)[0] as Tree).type, "img");
});

/** The figure's own children, flattened and without the empty slots. */
function ownChildren(tree: Tree): Node[] {
  const children = Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children];
  return (children as Node[]).filter((child) => child !== null && child !== undefined && child !== false);
}

test("the caption and credit are the figure's own children, outside the image wrapper", () => {
  const tree = render(
    { src: "/light.png", src_dark: "/dark.png", alt: "Diagram", credit: "Ada", credit_url: "https://example.com/ada" },
    "<p>A rich <em>caption</em> with <a href='/notes'>a link</a>.</p>",
  ) as Tree;
  assert.equal(tree.type, "figure");

  const children = ownChildren(tree);
  assert.deepEqual(
    children.map((child) => (child as Tree).type),
    ["div", "figcaption"],
  );
  assert.equal((children[0] as Tree).props.class, PAIR_CLASS);

  // The figure relationship and the accessible content survive the pairing.
  const figcaption = children[1] as Tree;
  const rich = find(figcaption, "figure-text") as Tree;
  const body = (rich.props.dangerouslySetInnerHTML as { __html: string }).__html;
  assert.match(body, /A rich <em>caption<\/em>/);
  assert.ok(textOf(figcaption).includes("Ada"));
  const creditLink = elements(figcaption).find((element) => element.type === "a") as Tree;
  assert.equal(creditLink.props.href, "https://example.com/ada");
  assert.equal(creditLink.props.rel, "noopener");
  assert.equal(textOf(creditLink), "Ada");
});

test("several images render inside one figure and share one caption", () => {
  const tree = render({
    images: JSON.stringify([
      { src: "/a.png", alt: "First image" },
      { src: "/b.png", alt: "Second image" },
    ]),
    caption: "Both at once",
  }) as Tree;
  assert.equal(tree.type, "figure");
  assert.equal(elements(tree).filter((element) => element.type === "figcaption").length, 1);
  const gallery = find(tree, "figure-images") as Tree;
  const images = imagesOf(gallery);
  assert.equal(images.length, 2);
  assert.deepEqual(
    images.map((image) => image.props.src),
    ["/a.png", "/b.png"],
  );
  assert.deepEqual(
    images.map((image) => image.props.alt),
    ["First image", "Second image"],
  );
  assert.equal(textOf(find(tree, "figure-caption")), "Both at once");
});

test("a broken or too-short images list falls back to the single image", () => {
  assert.deepEqual(imageList("not json"), []);
  assert.deepEqual(imageList(JSON.stringify([{ alt: "no source" }])), []);
  const tree = render({ src: "/a.png", images: JSON.stringify([{ src: "/b.png", alt: "B" }]) }) as Tree;
  assert.equal(imagesOf(tree).length, 1);
  assert.equal(find(tree, "figure-images"), undefined);
});

test("figure captions and galleries wrap instead of clipping on small screens", () => {
  const sheet = readFileSync(join(root, "styles/src/ui.css"), "utf8");
  const ruleOf = (selector: string) =>
    sheet.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  assert.match(ruleOf("\\.figure-caption"), /overflow-wrap:\s*anywhere/);
  assert.match(ruleOf("\\.figure-images"), /grid-template-columns/);
  assert.doesNotMatch(sheet, /\.figure-(caption|text|images)[^{]*\{[^}]*text-overflow:\s*ellipsis/);
});

test("root-relative image URLs take the site base, external ones stay", () => {
  const input = {
    props: {
      src: "/img/a.png",
      src_dark: "/img/a-dark.png",
      srcset: "/img/a.png 1x, /img/b.png 2x, https://cdn.test/c.png 3x",
      alt: "A pair",
    },
    html: "",
    page: {},
    site: { config: { base: "/lateen" } },
  } as unknown as ComponentProps<FigureProps>;
  const out = renderToString(figure(input) as never);
  assert.match(out, /src="\/lateen\/img\/a\.png"/);
  assert.match(out, /src="\/lateen\/img\/a-dark\.png"/);
  assert.match(out, /srcset="\/lateen\/img\/a\.png 1x, \/lateen\/img\/b\.png 2x, https:\/\/cdn\.test\/c\.png 3x"/);
});

test("an absolute image URL is never rewritten", () => {
  const input = {
    props: { src: "https://cdn.test/a.png", alt: "A" },
    html: "",
    page: {},
    site: { config: { base: "/lateen" } },
  } as unknown as ComponentProps<FigureProps>;
  assert.match(renderToString(figure(input) as never), /src="https:\/\/cdn\.test\/a\.png"/);
});
