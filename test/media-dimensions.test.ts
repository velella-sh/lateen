import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import video, {
  BOX_CLASS as VIDEO_BOX_CLASS,
  IMAGE_CLASS,
  POSTER_CLASS,
  type VideoProps,
} from "../components/video/index.ts";
import embed, {
  BOX_CLASS as EMBED_BOX_CLASS,
  PLACEHOLDER_CLASS,
  type EmbedProps,
} from "../components/embed/index.ts";
import figure, { type FigureProps } from "../components/figure/index.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const css = readFileSync(join(root, "styles/src/ui.css"), "utf8");

const TITLE = "Big Buck Bunny";
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

function renderVideo(props: VideoProps): string {
  const input = {
    props,
    html: "",
    page: { lang: "en" },
    site: {},
  } as unknown as ComponentProps<VideoProps>;
  return renderToString(video(input) as never);
}

function renderEmbed(props: EmbedProps): string {
  const input = {
    props,
    html: "",
    page: {} as ComponentProps["page"],
    site: {} as ComponentProps["site"],
  } as ComponentProps<EmbedProps>;
  return renderToString(embed(input) as never);
}

function renderFigure(props: FigureProps): string {
  const input = {
    props,
    html: "",
    page: {} as ComponentProps["page"],
    site: {} as ComponentProps["site"],
  } as ComponentProps<FigureProps>;
  return renderToString(figure(input) as never);
}

/** The declarations of the first rule whose selector matches `selector` as a regular expression. */
function declarations(selector: string): string {
  const match = new RegExp(`^[ \\t]*${selector}[ \\t]*\\{([^}]*)\\}`, "m").exec(css);
  assert.ok(match, `missing rule for ${selector}`);
  return match[1]!;
}

test("media boxes reserve a 16:9 frame before the poster or player arrives", () => {
  const box = declarations("\\.video-box,\\s*\\.embed-box");
  assert.match(box, /position:\s*relative/);
  assert.match(box, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(box, /overflow:\s*hidden/);
});

test("the poster, player, and embed frame fill the reserved box", () => {
  const fill = declarations("\\.video-poster,\\s*\\.video-frame,\\s*\\.embed-iframe");
  assert.match(fill, /position:\s*absolute/);
  assert.match(fill, /inset:\s*0/);
  assert.match(fill, /inline-size:\s*100%/);
  assert.match(fill, /block-size:\s*100%/);

  const image = declarations("\\.video-poster-image");
  assert.match(image, /inline-size:\s*100%/);
  assert.match(image, /block-size:\s*100%/);
  assert.match(image, /object-fit:\s*cover/);

  assert.match(css, /\n[ \t]*\.video-frame,\n[ \t]*\.embed-iframe\s*\{\s*border:\s*0;/);
});

test("the play control stays centered over the poster", () => {
  const play = declarations("\\.video-play");
  assert.match(play, /position:\s*absolute/);
  assert.match(play, /inset-block-start:\s*50%/);
  assert.match(play, /inset-inline-start:\s*50%/);
  assert.match(play, /transform:\s*translate\(-50%,\s*-50%\)/);
});

test("the embed placeholder stays readable inside the reserved frame", () => {
  const placeholder = declarations("\\.embed-placeholder");
  assert.match(placeholder, /display:\s*flex/);
  assert.match(placeholder, /flex-direction:\s*column/);
  assert.match(placeholder, /align-items:\s*center/);
  assert.match(placeholder, /justify-content:\s*center/);
  assert.match(placeholder, /gap:\s*var\(--space-\d+\)/);
  assert.match(placeholder, /padding:\s*var\(--space-\d+\)/);
});

test("print keeps a reserved frame in one piece", () => {
  const print = css.slice(css.indexOf("@media print"));
  assert.ok(print.length > 0, "missing the print block");
  assert.match(print, /\.video-box,\s*\.embed-box\s*\{\s*break-inside:\s*avoid;/);
});

test("video markup names its box and poster and guesses no dimensions", () => {
  const html = renderVideo({ src: WATCH, title: TITLE, poster: "/images/poster.jpg" });
  assert.match(html, new RegExp(`class="${VIDEO_BOX_CLASS}" data-video-box="true"`));
  assert.match(html, new RegExp(`class="${POSTER_CLASS}" data-video-poster="true"`));
  assert.match(html, new RegExp(`<img class="${IMAGE_CLASS}" src="/images/poster.jpg"`));
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /\s(?:width|height)=/);
});

test("embed markup names its box and placeholder and guesses no dimensions", () => {
  const html = renderEmbed({ src: WATCH, title: TITLE });
  assert.match(html, new RegExp(`class="${EMBED_BOX_CLASS}" data-embed-box="true"`));
  assert.match(html, new RegExp(`class="${PLACEHOLDER_CLASS}" data-embed-placeholder="true"`));
  assert.match(html, /data-embed-state="idle"/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /\s(?:width|height)=/);
});

test("the figure keeps its authored dimensions so the image is reserved before download", () => {
  const html = renderFigure({
    src: "/images/chart.png",
    alt: "A chart",
    width: "640",
    height: "360",
  });
  assert.match(html, /<img class="figure-img" src="\/images\/chart\.png" alt="A chart"/);
  assert.match(html, /\swidth="640"/);
  assert.match(html, /\sheight="360"/);
});
