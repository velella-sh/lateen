---
title: الإعدادات
description: إعدادات الملف sandbar.yml.
layout: doc
permalink: /ar/reference/configuration/
lang: ar
dir: rtl
order: 2
---

يحتوي الملف `sandbar.yml` على مفتاح رئيسي واحد هو `tasks` وكتلة اختيارية هي `settings`.

## المهام

| المفتاح | النوع | الوظيفة |
| --- | --- | --- |
| `run` | نص | الأمر الذي تشغّله المهمة. |
| `after` | قائمة بأسماء المهام | مهام تُشغَّل قبلها. |
| `env` | خريطة | متغيرات تضاف إلى بيئة الأمر. |

## الإعدادات

| المفتاح | الافتراضي | الوظيفة |
| --- | --- | --- |
| `shell` | `sh` | الصدفة التي تشغّل كل أمر. |
| `parallel` | `1` | أكبر عدد من المهام يعمل في وقت واحد. |

```yaml
settings:
  shell: bash
  parallel: 2
```
