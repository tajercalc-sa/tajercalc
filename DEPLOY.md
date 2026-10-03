# نشر حاسبة تاجر على tajercalc.com

حساب GitHub: `tajercalc-sa`، والإيميل: `tajercalc@gmail.com`، والدومين من Namecheap.
الاسم والدومين والإيميل مكتوبة داخل `lib/site.ts`، فما تحتاج ملف `.env.local` ولا إعدادات إضافية في GitHub.

---

## 1. إنشاء المستودع (مرة واحدة)

1. سجّل دخول GitHub بحساب **tajercalc-sa**.
2. افتح https://github.com/new
   - Repository name: `tajercalc`
   - اختر **Public** (النشر المجاني يتطلب ذلك)
   - **لا** تضف README ولا .gitignore ولا License
   - اضغط **Create repository**

## 2. رفع الكود

ثبّت Git إذا ما كان عندك: https://git-scm.com/download/win

فك ضغط `tajer-calc-nextjs.zip`، وافتح مجلد `tajer-calc` في VS Code، ثم افتح Terminal واكتب الأوامر بالترتيب:

```bash
git init
git config user.name "tajercalc-sa"
git config user.email "tajercalc@gmail.com"
git add .
git commit -m "first version"
git branch -M main
git remote add origin https://github.com/tajercalc-sa/tajercalc.git
git push -u origin main
```

- السطران `git config` مهمان: بدونهما يظهر اسمك الحقيقي على الكود العام، لأن Git يستخدم إعداداتك العامة.
- عند `git push` تفتح نافذة تسجيل دخول. **سجّل بحساب tajercalc-sa**. إذا ظهر خطأ 403، فجهازك مسجّل بحساب GitHub ثاني: افتح Windows Credential Manager، واحذف بيانات `git:https://github.com`، ثم أعد `git push`.

## 3. تفعيل النشر

1. في المستودع: **Settings ← Pages**.
2. تحت **Build and deployment ← Source** اختر **GitHub Actions**.
3. افتح تبويب **Actions**. إذا كان آخر تشغيل فاشلاً (لأنه اشتغل قبل تفعيل Pages)، افتحه واضغط **Re-run all jobs**.
4. انتظر العلامة الخضراء (دقيقتين تقريباً). الموقع يشتغل مؤقتاً على:
   https://tajercalc-sa.github.io/tajercalc/

## 4. ربط الدومين

**في GitHub:** Settings ← Pages ← **Custom domain**، اكتب `tajercalc.com` واضغط **Save**.

**في Namecheap:** Domain List ← بجانب tajercalc.com اضغط **Manage** ← تبويب **Advanced DNS**:

1. احذف السجلات الموجودة افتراضياً (مثل CNAME لـ `parkingpage` أو URL Redirect).
2. أضف هذه السجلات (TTL: Automatic):

| Type | Host | Value |
|---|---|---|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| CNAME Record | www | tajercalc-sa.github.io. |

3. انتظر: غالباً من دقائق إلى ساعات، وأحياناً حتى 24 ساعة.
4. لما يظهر في GitHub أن الدومين سليم، فعّل **Enforce HTTPS** في نفس صفحة Pages.

**موصى به (حماية):** في إعدادات **حسابك** (مو المستودع): Settings ← Pages ← **Add a domain**، وأضف `tajercalc.com`. يعطيك GitHub سجل TXT تضيفه في Namecheap. هذا يمنع أي أحد ثاني من ربط دومينك بموقعه.

## 5. بعد ما يشتغل الموقع

1. **Google Search Console:** https://search.google.com/search-console
   سجّل بـ tajercalc@gmail.com، ثم أضف `tajercalc.com` من نوع **Domain**، وأضف سجل TXT اللي يعطيك إياه في Namecheap (Advanced DNS). بعد التحقق: **Sitemaps** ← أرسل `sitemap.xml`.
2. جرّب مشاركة الرابط في واتساب، وتأكد أن صورة المعاينة تظهر.

## تحديث الموقع لاحقاً

أي تعديل: غيّر الملفات، ثم:

```bash
git add .
git commit -m "وصف التعديل"
git push
```

والنشر يصير تلقائياً خلال دقيقتين.
