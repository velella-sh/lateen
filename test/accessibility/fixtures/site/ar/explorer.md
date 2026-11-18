---
title: مستكشف البيانات
description: صفِّ مجموعة الكتب ورتِّبها أثناء الكتابة، مع صفحة البحث بديلًا.
layout: doc
permalink: /ar/explorer/
lang: ar
dir: rtl
---

يقرأ مستكشف البيانات مجموعة الكتب أثناء الكتابة. وبدون جافاسكربت يحتفظ الصفحة نفسها بجدوله،
ويرسل النموذج إلى صفحة نتائج البحث.

::data-explorer{from=books columns='[{"field":"title","label":"العنوان"},{"field":"pages","label":"الصفحات","kind":"number"},{"field":"published","label":"تاريخ النشر","kind":"date"}]' filters=published sort=title,pages}
