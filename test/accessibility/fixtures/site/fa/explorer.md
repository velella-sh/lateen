---
title: کاوشگر داده
description: مجموعهٔ کتاب‌ها را هنگام تایپ پالایش و مرتب کنید، با صفحهٔ جست‌وجو به‌عنوان جایگزین.
layout: doc
permalink: /fa/explorer/
lang: fa
dir: rtl
---

کاوشگر داده مجموعهٔ کتاب‌ها را هنگام تایپ می‌خواند. بدون جاوااسکریپت همان صفحه جدول خود را نگه
می‌دارد و فرم به صفحهٔ نتایج جست‌وجو می‌رود.

::data-explorer{from=books columns='[{"field":"title","label":"عنوان"},{"field":"pages","label":"صفحه‌ها","kind":"number"},{"field":"published","label":"تاریخ انتشار","kind":"date"}]' filters=published sort=title,pages}
