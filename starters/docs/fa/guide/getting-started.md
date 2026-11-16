---
title: شروع کار
description: سندبار را نصب کنید و نخستین کار را اجرا کنید.
layout: doc
permalink: /fa/guide/getting-started/
lang: fa
dir: rtl
order: 1
---

سندبار ابزاری ساختگی است، پس هیچ‌یک از این دستورها واقعاً چیزی نصب نمی‌کند. این مراحل نشان می‌دهند که یک راهنما وقتی متنش از خودتان باشد چگونه خوانده می‌شود.

## نصب

:::code-tabs{labels='["npm","pnpm"]'}
```bash
npm install --save-dev sandbar
```

```bash
pnpm add --save-dev sandbar
```
:::

:::callout{type=note title="پیش‌نیازها"}
سندبار به Node نسخهٔ ۲۴ یا بالاتر نیاز دارد. برای بررسی، `node --version` را اجرا کنید.
:::

## نوشتن فایل کارها

در ریشهٔ پروژه فایل `sandbar.yml` را بسازید:

```yaml
tasks:
  build:
    run: npm run build
  test:
    run: npm test
    after: [build]
```

اکنون پروژه این‌گونه است:

:::file-tree{label="ساختار پروژه"}
- my-project/
  - **sandbar.yml** # فایل کارها
  - package.json
  - src/
:::

## اجرای یک کار

```bash
npx sandbar run test
```

سندبار ابتدا `build` را اجرا می‌کند، چون `test` آن را در `after` آورده است، و سپس `test` را.

:::details{summary="اگر کاری شکست بخورد چه می‌شود؟"}
سندبار در نخستین کار ناموفق می‌ایستد و با کد خروج همان کار خارج می‌شود. با `--keep-going` کارهایی که به آن وابسته نیستند اجرا می‌شوند.
:::

## بعد از این

[مرجع دستورها](/fa/reference/commands/) و [مرجع پیکربندی](/fa/reference/configuration/) را بخوانید.
