---
title: شارة الحالة ودليلها
description: شارة الحالة بكل نبرة والدليل الذي يشرح قيم الموقع.
layout: doc
permalink: /ar/status/
lang: ar
dir: rtl
---

شارة الحالة تسمية صغيرة بلون النبرة وأيقونتها. الأيقونة مخفية عن التقنيات المساعدة؛ النص يحمل
المعنى، لذا تُقرأ كل نبرة دون لون.

::status[مكتمل]{tone=positive} ::status[يحتاج مراجعة]{tone=caution} ::status[محظور]{tone=negative}
::status[محايد]{tone=neutral} ::status[معلوماتي]{tone=info}

تأتي الشارة نفسها من خريطة قيم الموقع عندما يسمّي التوجيه قيمة:

::status{value=done} ::status{value=late}

::status-legend

يسرد الدليل كل قيمة معيّنة بترتيب الخريطة؛ ويسرد `::status-legend{values="late,done"}` مجموعة فرعية
بالترتيب المعطى.
