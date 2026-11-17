---
title: نشان وضعیت و راهنما
description: نشان وضعیت در هر لحن و راهنمایی که ارزش‌های سایت را توضیح می‌دهد.
layout: doc
permalink: /fa/status/
lang: fa
dir: rtl
---

نشان وضعیت یک برچسب کوچک با رنگ و نماد لحن است. نماد از فناوری کمکی پنهان است؛ متن معنا را
می‌رساند، پس هر لحن بدون رنگ خوانده می‌شود.

::status[انجام شد]{tone=positive} ::status[نیازمند بررسی]{tone=caution} ::status[مسدود]{tone=negative}
::status[خنثی]{tone=neutral} ::status[اطلاعاتی]{tone=info}

همین نشان از نقشهٔ ارزش‌های سایت می‌آید وقتی دستور یک ارزش را نام می‌برد:

::status{value=done} ::status{value=late}

::status-legend

راهنما هر ارزش نگاشت‌شده را به ترتیب نقشه فهرست می‌کند؛ `::status-legend{values="late,done"}` زیرمجموعه‌ای
را به ترتیب داده‌شده فهرست می‌کند.
