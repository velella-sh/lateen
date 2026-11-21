---
title: Install and quickstart
description: Install Lateen and Mizzen, write your first Markdown page, and preview it locally.
layout: doc
quickstart: true
permalink: /install/
---

**Before you start:** Open an empty project folder with Node.js 24 or later and npm. Run `node --version` and `npm --version` to check your setup.

<section class="quickstart-step">

## Install

Create a package and install Mizzen 0.2.5 and Lateen 0.2.3.

```sh
npm init -y
npm install --save-exact \
  @velella/mizzen@0.2.5 \
  @velella/lateen@0.2.3
```

</section>

<section class="quickstart-step">

## Configure the site

Run this from the project folder to create `mizzen.yml`. It sets the site title and tells Mizzen to use the installed Lateen theme.

```sh
cat > mizzen.yml <<'EOF_CONFIG'
title: My docs
theme:
  name: "@velella/lateen"
EOF_CONFIG
```

</section>

<section class="quickstart-step">

## Write the first page

Run this from the same folder to create `index.md`. Its front matter sets the page title, and the text below it is the page body.

```sh
cat > index.md <<'EOF_PAGE'
---
title: Welcome to my docs
---

My first page with Lateen.
EOF_PAGE
```

</section>

<section class="quickstart-step">

## Preview the site

```sh
npx mizzen dev .
```

Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in your browser. The home page shows **Welcome to my docs**. Leave the preview running while you edit `index.md` to see your changes.

</section>

Explore [starters](/starters/) for complete sites, [layouts](/layouts/) for page types, or [tokens and options](/tokens/) to customize the theme.
