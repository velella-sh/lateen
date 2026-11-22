---
title: نشر تقرير دوري
layout: doc
translation_key: report-guide
---

احفظ بيانات كل دورة في ملف مؤرّخ داخل `_data/`. قبل تغيير مصدر مجموعة `current`،
أنشئ مجموعة مستقلة للدورة السابقة وصفحة لها في [الأرشيف](../../archive/).

بعد تثبيت ملف البيانات في Git، يسجّل الأمر `mizzen data snapshot current` معرّف التثبيت وتاريخه.
افحص الموقع في النهاية باستخدام `mizzen check`.
