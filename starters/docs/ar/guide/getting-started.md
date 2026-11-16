---
title: البدء
description: ثبّت ساندبار وشغّل أول مهمة.
layout: doc
permalink: /ar/guide/getting-started/
lang: ar
dir: rtl
order: 1
---

ساندبار أداة مخترعة، لذلك لا تثبّت هذه الأوامر شيئًا فعليًا. تبيّن الخطوات كيف يُقرأ الدليل عندما يصبح نصه من كتابتك.

## التثبيت

:::code-tabs{labels='["npm","pnpm"]'}
```bash
npm install --save-dev sandbar
```

```bash
pnpm add --save-dev sandbar
```
:::

:::callout{type=note title="المتطلبات"}
يحتاج ساندبار إلى Node بالإصدار 24 أو أحدث. شغّل `node --version` للتحقق.
:::

## كتابة ملف المهام

أنشئ الملف `sandbar.yml` في جذر المشروع:

```yaml
tasks:
  build:
    run: npm run build
  test:
    run: npm test
    after: [build]
```

يبدو المشروع الآن هكذا:

:::file-tree{label="بنية المشروع"}
- my-project/
  - **sandbar.yml** # ملف المهام
  - package.json
  - src/
:::

## تشغيل مهمة

```bash
npx sandbar run test
```

يشغّل ساندبار `build` أولًا لأن `test` يذكرها في `after`، ثم يشغّل `test`.

:::details{summary="ماذا لو فشلت مهمة؟"}
يتوقف ساندبار عند أول مهمة فاشلة ويخرج برمز خروج تلك المهمة. استخدم `--keep-going` لتشغيل المهام التي لا تعتمد عليها.
:::

## بعد ذلك

اقرأ [مرجع الأوامر](/ar/reference/commands/) و[مرجع الإعدادات](/ar/reference/configuration/).
