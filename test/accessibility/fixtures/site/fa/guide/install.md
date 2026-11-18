---
title: نصب ویجت
description: صفحهٔ راهنما در ماتریس دسترس‌پذیری، با همهٔ اجزای راهنما.
layout: guide
permalink: /fa/guide/install/
lang: fa
dir: rtl
tags: [نصب]
guide:
  from: 0.1
  to: 0.2
  time: ۱۰ دقیقه
  risk: done
---

صفحهٔ راهنما با نوار خلاصه بالای متن و راهنمای بعدی در پایان صفحه.

## پیش از شروع

ویجت به Node 24 یا جدیدتر نیاز دارد. خروجی قدیمی را تا موفق‌شدن بررسی‌ها نگه دارید.

:::steps
1. بسته را نصب کنید.
2. سایت را بسازید.
3. خروجی را بخوانید.
:::

:::before-after{removed="1" added="1"}
```bash
widget build --out old
```

```bash
widget build --out dist
```
:::

:::trap
خروجی قدیمی را کنار خروجی جدید نگه دارید تا بررسی موفق شود.
:::

:::check-list
- `npm run build` — ساخت تمام می‌شود.
- `npm test` — آزمون‌ها قبول می‌شوند.
:::
