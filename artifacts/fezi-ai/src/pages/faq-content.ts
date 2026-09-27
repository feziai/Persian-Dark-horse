type Localized = { en: string; fa: string };
export type FAQItem = { question: Localized; answer: Localized };
export type FAQCategory = { id: string; title: Localized; items: FAQItem[] };

const entry = (enQuestion: string, enAnswer: string, faQuestion: string, faAnswer: string): FAQItem => ({
  question: { en: enQuestion, fa: faQuestion },
  answer: { en: enAnswer, fa: faAnswer },
});

export const faqCategories: FAQCategory[] = [
  {
    id: 'getting-started', title: { en: 'Getting started', fa: 'شروع کار' }, items: [
      entry('What is Persian Dark Horse?', 'Persian Dark Horse brings chat, specialized agents, creative studios, prompts, projects, and a community into one bilingual workspace. Open a section from the desktop sidebar or the mobile More menu.',
        'اسب تیره فارسی چیست؟', 'اسب تیره فارسی یک فضای کاری دوزبانه برای چت، ایجنت‌های تخصصی، استودیوهای خلاقیت، پرامپت‌ها، پروژه‌ها و کامیونیتی است. بخش‌ها را از منوی کنار در رایانه یا «بیشتر» در موبایل باز کنید.'),
      entry('Can I use Persian Dark Horse without an account?', 'You can browse public pages, apps and community posts as a visitor. Sign in before sending a chat message, generating content, saving work or using account-specific features.',
        'آیا بدون حساب می‌توانم از اسب تیره فارسی استفاده کنم؟', 'به‌عنوان مهمان می‌توانید صفحه‌های عمومی، برنامه‌ها و پست‌های کامیونیتی را ببینید. برای ارسال پیام، تولید محتوا، ذخیره کار یا امکانات مخصوص حساب باید وارد شوید.'),
      entry('Where do I change the language and appearance?', 'Use the language switch in the navigation for English or Persian. Settings and Personalization contain your theme and workspace preferences; the selected theme is saved.',
        'زبان و ظاهر را از کجا تغییر بدهم؟', 'از تغییر زبان در منو، فارسی یا انگلیسی را انتخاب کنید. تنظیمات و شخصی‌سازی گزینه‌های ظاهر و فضای کار را دارند و تم انتخابی ذخیره می‌شود.'),
      entry('Does Persian Dark Horse work on phones and computers?', 'Yes. The same workspace has desktop navigation and a mobile bottom bar plus a More menu. Availability of microphone, wallet, and push features also depends on your device and browser.',
        'اسب تیره فارسی روی گوشی و رایانه کار می‌کند؟', 'بله. در رایانه از منوی کناری و در موبایل از نوار پایین و منوی «بیشتر» استفاده کنید. دسترسی به میکروفن، کیف پول و اعلان به دستگاه و مرورگر هم بستگی دارد.'),
    ],
  },
  {
    id: 'chat', title: { en: 'Chat, models & files', fa: 'چت، مدل‌ها و فایل‌ها' }, items: [
      entry('How do I start or resume a conversation?', 'Open Chat, choose an available agent or model, and send a message. Use Chat history to return to saved conversations. A new chat starts a separate thread.',
        'چطور چت را شروع یا ادامه بدهم؟', 'چت را باز کنید، ایجنت یا مدل در دسترس را انتخاب کنید و پیام بفرستید. از تاریخچه چت به گفت‌وگوهای ذخیره‌شده برگردید. «چت جدید» گفت‌وگوی مستقلی می‌سازد.'),
      entry('Which AI model answers me?', 'The selected chat route determines the response. A free or smart route can choose its underlying provider dynamically; a listed provider is not a guarantee it is available at every moment. Check the selector and any error shown before retrying.',
        'کدام مدل هوش مصنوعی پاسخ می‌دهد؟', 'مسیر انتخاب‌شده در چت پاسخ را تعیین می‌کند. مسیر رایگان یا هوشمند ممکن است ارائه‌دهنده را به‌صورت پویا انتخاب کند؛ نمایش یک مدل به معنی دسترس‌بودن دائمی آن نیست. پیش از تلاش دوباره، انتخاب‌گر و پیام خطا را بررسی کنید.'),
      entry('Can I attach a file or image?', 'Use the attachment control in Chat and select a supported file. What Persian Dark Horse can extract depends on file format and quality; if extraction fails, it reports the problem rather than inventing file contents. Do not upload secrets or material you are not allowed to share.',
        'می‌توانم فایل یا عکس بفرستم؟', 'از دکمه پیوست در چت و فایل پشتیبانی‌شده استفاده کنید. استخراج محتوا به نوع و کیفیت فایل وابسته است؛ اگر ممکن نباشد، اسب تیره فارسی خطا نشان می‌دهد، نه محتوای ساختگی. رمزها یا محتوایی که مجاز به اشتراک آن نیستید نفرستید.'),
      entry('Are voice messages and spoken answers available?', 'Where your browser permits microphone access and the selected service supports it, Chat offers voice input and/or spoken output. Allow microphone permission when prompted; if a voice option is unavailable, use text.',
        'پیام صوتی و پاسخ گفتاری وجود دارد؟', 'اگر مرورگر اجازه میکروفن بدهد و سرویس انتخاب‌شده پشتیبانی کند، ورودی صوتی یا پاسخ گفتاری در چت در دسترس است. هنگام درخواست، مجوز میکروفن را بدهید؛ در صورت نبود گزینه صوتی از متن استفاده کنید.'),
      entry('Are AI responses always correct?', 'No. Responses can be incomplete or mistaken, especially for current events, calculations and uploaded documents. Check important facts against original sources and do not treat AI output as professional medical, legal or financial advice.',
        'پاسخ‌های هوش مصنوعی همیشه درست‌اند؟', 'نه. پاسخ ممکن است ناقص یا اشتباه باشد، به‌ویژه در خبرهای تازه، محاسبات و اسناد بارگذاری‌شده. اطلاعات مهم را با منبع اصلی بررسی کنید و خروجی را جایگزین مشاوره تخصصی پزشکی، حقوقی یا مالی ندانید.'),
    ],
  },
  {
    id: 'agents', title: { en: 'Agents & apps', fa: 'ایجنت‌ها و برنامه‌ها' }, items: [
      entry('What are agents?', 'Agents are AI experiences with different purposes and instructions. Browse Apps or choose an agent in Chat to see what each one does. Available tools and models vary by agent.',
        'ایجنت چیست؟', 'ایجنت‌ها تجربه‌های هوش مصنوعی با کاربرد و دستورالعمل متفاوت هستند. برای دیدن کار هرکدام، برنامه‌ها را مرور کنید یا در چت ایجنت انتخاب کنید. ابزار و مدل‌های هر ایجنت می‌تواند متفاوت باشد.'),
      entry('Can I make my own agent?', 'Open My Agents to create, edit, and manage a custom agent. Set its name, purpose, instructions, model options, visibility and avatar. Creation and some capabilities depend on your account access and limits.',
        'می‌توانم ایجنت خودم را بسازم؟', 'از «ایجنت‌های من» برای ساخت، ویرایش و مدیریت ایجنت استفاده کنید. نام، هدف، دستورالعمل، گزینه‌های مدل، وضعیت انتشار و آواتار را تعیین کنید. ساخت و برخی قابلیت‌ها به دسترسی و محدودیت حساب بستگی دارند.'),
      entry('Can I upload a custom agent avatar?', 'The current agent builder offers a gallery of avatars, including FEZI as the default. Direct upload of a new custom agent avatar is not currently available there. Changing an agent’s selected avatar does not change other agents.',
        'می‌توانم عکس دلخواه برای ایجنت بارگذاری کنم؟', 'سازنده فعلی، گالری آواتار دارد و تصویر پیش‌فرض آن فزی است. بارگذاری مستقیم آواتار دلخواه در آن بخش فعلاً در دسترس نیست. تغییر آواتار یک ایجنت، تصویر ایجنت‌های دیگر را تغییر نمی‌دهد.'),
      entry('Can other people see or use my agent?', 'Visibility controls whether an agent is private or discoverable. Check its visibility and any website/API settings before sharing. Keep private instructions, credentials and personal data out of publicly visible fields.',
        'دیگران می‌توانند ایجنت من را ببینند؟', 'تنظیم انتشار مشخص می‌کند ایجنت خصوصی باشد یا قابل کشف. پیش از اشتراک‌گذاری، وضعیت انتشار و تنظیمات وب‌سایت یا API آن را بررسی کنید. اطلاعات محرمانه را در بخش‌های عمومی نگذارید.'),
    ],
  },
  {
    id: 'creation', title: { en: 'Studios & Prompt Studio', fa: 'استودیوها و استودیو پرامپت' }, items: [
      entry('What can I do in the creative studios?', 'Image, Video, Voice and Code studios provide task-specific controls and show relevant access or credit information. Select a studio and read its available actions and price before running a task; displayed provider catalogs are not a promise that every external tool is integrated.',
        'در استودیوهای خلاقیت چه کاری می‌توانم انجام بدهم؟', 'استودیوهای تصویر، ویدیو، صدا و کد کنترل‌های مخصوص هر کار و اطلاعات دسترسی یا اعتبار را نشان می‌دهند. پیش از اجرای کار، امکانات و هزینه همان صفحه را بخوانید؛ نمایش نام ابزارها به معنی اتصال مستقیم همه آن‌ها نیست.'),
      entry('Does Video Studio generate a native video?', 'Currently its motion workflow can produce a short rendered preview, not a guaranteed native video from an external video model. Review the output label before treating a preview as a finished video.',
        'استودیو ویدیو فایل ویدیوی بومی مدل‌ها تولید می‌کند؟', 'در حال حاضر مسیر موشن می‌تواند پیش‌نمایش رندرشده کوتاه بسازد، نه لزوماً ویدیوی بومی یک مدل خارجی. برچسب خروجی را بررسی کنید تا پیش‌نمایش را با ویدیوی نهایی اشتباه نگیرید.'),
      entry('What is Prompt Studio?', 'It is a place to browse, create, save and share prompts and their associated examples. A prompt card is guidance or a starting point; opening one does not guarantee an external model has generated its example.',
        'استودیو پرامپت چیست؟', 'جایی برای دیدن، ساخت، ذخیره و اشتراک پرامپت‌ها و نمونه‌های همراه آن‌هاست. کارت پرامپت راهنما و نقطه شروع است؛ بازکردن آن به معنی تولید نمونه توسط یک مدل خارجی نیست.'),
      entry('Who can see something I publish?', 'Check the publishing or visibility control before posting a prompt, agent or community item. Public items can be seen by other visitors; private chat context and personalization are not meant to become public profile fields.',
        'چه کسانی محتوای منتشرشده مرا می‌بینند؟', 'پیش از انتشار پرامپت، ایجنت یا پست، گزینه نمایش را بررسی کنید. محتوای عمومی برای دیگران قابل مشاهده است؛ زمینه خصوصی چت و شخصی‌سازی نباید به پروفایل عمومی منتقل شوند.'),
    ],
  },
  {
    id: 'projects', title: { en: 'Projects & saved work', fa: 'پروژه‌ها و کارهای ذخیره‌شده' }, items: [
      entry('What is a project?', 'Projects organize your work. You can create and update projects, change their status and associate chats or agents with them from the Projects section in the desktop menu or mobile More menu.',
        'پروژه چیست؟', 'پروژه‌ها برای مرتب‌کردن کارها هستند. در بخش پروژه‌ها از منوی رایانه یا «بیشتر» در موبایل می‌توانید پروژه بسازید، ویرایش کنید، وضعیت آن را تغییر دهید و چت یا ایجنت به آن مرتبط کنید.'),
      entry('Will projects saved in this browser appear in my account?', 'Not automatically. If you used browser-local projects earlier, use the explicit import option in Projects after signing in. Review duplicates before importing; browser-local data is not a backup across devices.',
        'پروژه‌های ذخیره‌شده در این مرورگر خودکار وارد حساب می‌شوند؟', 'خیر. اگر قبلاً پروژه محلی در مرورگر ساخته‌اید، پس از ورود از گزینه واردکردن در بخش پروژه‌ها استفاده کنید. موارد تکراری را بررسی کنید؛ داده محلی مرورگر نسخه پشتیبان میان دستگاه‌ها نیست.'),
      entry('Can I delete a project or conversation?', 'Use the relevant delete control in Projects or Chat history. Review what is being removed before confirming; deleting a saved item is different from merely leaving its page.',
        'می‌توانم پروژه یا گفت‌وگو را حذف کنم؟', 'از گزینه حذف در پروژه‌ها یا تاریخچه چت استفاده کنید. پیش از تأیید، مورد انتخاب‌شده را بررسی کنید؛ حذف داده با ترک‌کردن صفحه تفاوت دارد.'),
    ],
  },
  {
    id: 'billing', title: { en: 'Plans, payments & wallets', fa: 'پلن‌ها، پرداخت و کیف پول' }, items: [
      entry('Where can I see plans, prices and my access?', 'Open Billing for the current plan list, supported currencies, checkout details and your account’s status. Prices and entitlements may change; rely on the current quote and plan description on that page rather than an old screenshot.',
        'پلن‌ها، قیمت و دسترسی خود را از کجا ببینم؟', 'برای فهرست روز پلن‌ها، ارزها، جزئیات پرداخت و وضعیت حساب به «صورت‌حساب» بروید. قیمت و امکانات ممکن است تغییر کنند؛ به توضیح پلن و پیش‌فاکتور فعلی همان صفحه تکیه کنید، نه تصویر قدیمی.'),
      entry('Are a subscription and API Credits the same?', 'No. A subscription controls its listed app/agent benefits; API Credits are a separate, metered balance for eligible API use. Buying one does not automatically add the other. Review each product and balance separately in Billing and API Keys.',
        'اشتراک و اعتبار API یکی هستند؟', 'خیر. اشتراک امکانات درج‌شده برای برنامه یا ایجنت را کنترل می‌کند؛ اعتبار API موجودی جداگانه برای استفاده مبتنی بر مصرف است. خرید یکی، دیگری را خودکار اضافه نمی‌کند. هر کدام را جدا در صورت‌حساب و کلیدهای API بررسی کنید.'),
      entry('How does a cryptocurrency payment work?', 'Use a fresh quote in Billing, follow its exact network, asset, amount, recipient and time instructions, then submit the transaction ID in the payment flow. Sending funds or connecting a wallet alone does not activate access: the server must verify the transaction, and some payments require admin approval.',
        'پرداخت رمزارزی چگونه انجام می‌شود؟', 'در صورت‌حساب پیش‌فاکتور تازه بگیرید و شبکه، ارز، مبلغ، مقصد و زمان آن را دقیق رعایت کنید؛ سپس شناسه تراکنش را در مسیر پرداخت ثبت کنید. صرف ارسال وجه یا اتصال کیف پول دسترسی را فعال نمی‌کند: تراکنش باید در سرور بررسی شود و بعضی پرداخت‌ها تأیید مدیر هم می‌خواهند.'),
      entry('Does connecting a wallet move money or verify a payment?', 'No. Wallet connection lets the app read your public address where supported; it does not transfer funds or prove you paid. Some listed wallets only have an install/open link and cannot connect directly. Never share a seed phrase or private key.',
        'اتصال کیف پول پول منتقل می‌کند یا پرداخت را تأیید می‌کند؟', 'خیر. اتصال کیف پول، در صورت پشتیبانی، آدرس عمومی را می‌خواند و نه پول جابه‌جا می‌کند و نه پرداخت را ثابت می‌کند. بعضی کیف پول‌ها فقط لینک نصب/بازکردن دارند. عبارت بازیابی یا کلید خصوصی خود را به هیچ‌کس ندهید.'),
      entry('Where do I enter a redeem code or find referrals?', 'Check Billing for the redeem-code and referral sections if they are available to your account. A code only grants the benefit specified for that code; it is not interchangeable with cash, a subscription or API Credits unless its terms say so.',
        'کد هدیه یا معرفی را کجا پیدا کنم؟', 'در صورت‌حساب، بخش کد هدیه و معرفی را در صورت دسترسی حساب بررسی کنید. هر کد فقط مزیت مشخص‌شده برای همان کد را می‌دهد و بدون شرایط صریح، معادل پول نقد، اشتراک یا اعتبار API نیست.'),
    ],
  },
  {
    id: 'api', title: { en: 'API access & credits', fa: 'دسترسی API و اعتبار' }, items: [
      entry('Where do I manage API access?', 'Use API Keys for the available catalog, balances and key controls. Availability can depend on the agent, plan or separate API entitlement. A key is not the same as a subscription.',
        'دسترسی API را کجا مدیریت کنم؟', 'در «کلیدهای API» فهرست سرویس‌ها، موجودی و کلیدها را ببینید. دسترسی می‌تواند به ایجنت، پلن یا مجوز جداگانه API وابسته باشد. داشتن کلید همان داشتن اشتراک نیست.'),
      entry('How do API Credits get used?', 'Eligible API requests use the relevant metered balance. The charged amount depends on the operation and current pricing; check the page before buying. A failed operation should not be treated as a successful billable result—contact Support with the request details if a balance looks wrong.',
        'اعتبار API چطور مصرف می‌شود؟', 'درخواست‌های مجاز API از موجودی مربوط به همان سرویس و بر اساس مصرف کم می‌کنند. مبلغ به نوع عملیات و قیمت فعلی بستگی دارد؛ پیش از خرید صفحه را بررسی کنید. خطای عملیات نباید نتیجه موفقِ قابل‌کسر تلقی شود؛ اگر موجودی نادرست است جزئیات درخواست را به پشتیبانی بدهید.'),
      entry('Can I see a secret API key again?', 'Treat a newly issued key like a password and save it securely when shown. Raw custom-agent keys are displayed only once; if lost, create or rotate a key instead of expecting the old value to be revealed.',
        'می‌توانم کلید محرمانه API را دوباره ببینم؟', 'کلید تازه را مانند رمز عبور در محل امن نگه دارید. مقدار خام کلید ایجنت سفارشی فقط یک‌بار نمایش داده می‌شود؛ اگر گم شد، به‌جای انتظار نمایش دوباره، کلید جدید بسازید یا آن را بچرخانید.'),
      entry('Why can an API request be rejected?', 'Possible causes include an invalid or missing key, no entitlement, insufficient balance, unsupported operation, rate limits or a temporary provider error. Read the returned error and check the key, access and balance before retrying.',
        'چرا درخواست API رد می‌شود؟', 'کلید نامعتبر یا ناموجود، نداشتن مجوز، موجودی ناکافی، عملیات پشتیبانی‌نشده، محدودیت نرخ یا خطای موقت ارائه‌دهنده از علت‌های ممکن‌اند. پیام خطا را بخوانید و پیش از تلاش دوباره کلید، دسترسی و موجودی را بررسی کنید.'),
    ],
  },
  {
    id: 'community', title: { en: 'Community & news', fa: 'کامیونیتی و اخبار' }, items: [
      entry('What can I do in the Community?', 'Browse public posts and news. With an eligible signed-in account you can post, reply, like, follow, message and view profiles. Use the Community tab on mobile or the sidebar on desktop.',
        'در کامیونیتی چه کار می‌توانم بکنم؟', 'پست‌ها و خبرهای عمومی را ببینید. با حساب واردشده و واجد شرایط می‌توانید پست و پاسخ بگذارید، لایک کنید، دنبال کنید، پیام بدهید و پروفایل‌ها را ببینید. در موبایل از تب کامیونیتی و در رایانه از منوی کناری وارد شوید.'),
      entry('Why can I read but not post or send a message?', 'Browsing is public, but posting, uploading and sending direct messages require sign-in and verification of your primary email address. Check your account’s email verification if an action is blocked.',
        'چرا می‌توانم بخوانم ولی پست یا پیام نمی‌فرستم؟', 'دیدن محتوا عمومی است، اما پست، بارگذاری و پیام خصوصی به ورود و تأیید ایمیل اصلی حساب نیاز دارند. اگر عملی مسدود شد، وضعیت تأیید ایمیل حساب را بررسی کنید.'),
      entry('What media can I attach to a post?', 'The post composer supports images or one video, subject to the current upload validation. The app checks format, ownership and file size and shows an error when a file cannot be accepted. Avoid posting other people’s private or copyrighted material without permission.',
        'چه رسانه‌ای می‌توانم به پست اضافه کنم؟', 'ویرایشگر پست از تصویر یا یک ویدیو، مطابق اعتبارسنجی بارگذاری، پشتیبانی می‌کند. برنامه نوع فایل، مالکیت و اندازه را بررسی می‌کند و در صورت رد فایل خطا نشان می‌دهد. اطلاعات خصوصی یا آثار دیگران را بدون اجازه منتشر نکنید.'),
      entry('How do blocking and reporting work?', 'Use a person’s profile or a post’s menu to block or report. Blocking hides interaction in both directions and prevents direct messaging between you; reporting sends a moderation request, not an immediate guaranteed removal. You can unblock later.',
        'مسدودسازی و گزارش چطور کار می‌کنند؟', 'از پروفایل شخص یا منوی پست برای مسدودکردن یا گزارش استفاده کنید. مسدودسازی تعامل دوطرفه را پنهان و پیام خصوصی بین شما را متوقف می‌کند؛ گزارش درخواست رسیدگی است، نه حذف تضمینی و فوری. بعداً می‌توانید رفع مسدودسازی کنید.'),
      entry('Where do Persian Dark Horse news posts come from?', 'Persian Dark Horse may publish official updates and short attributed excerpts from an external news provider. Use the source link to read the original article. External headlines and summaries are not independent fact-checks by Persian Dark Horse.',
        'خبرهای اسب تیره فارسی از کجا می‌آیند؟', 'اسب تیره فارسی ممکن است اطلاعیه رسمی یا گزیده کوتاهِ منبع‌دار از سرویس خبری بیرونی منتشر کند. برای خواندن متن اصلی از لینک منبع استفاده کنید. تیتر و خلاصه بیرونی به معنی راستی‌آزمایی مستقل نیست.'),
    ],
  },
  {
    id: 'notifications', title: { en: 'Notifications', fa: 'اعلان‌ها' }, items: [
      entry('How do I get Community notifications?', 'The bell shows in-app activity such as replies, likes, follows and messages. For device notifications, opt in from the notification control and allow browser permission; they are not enabled automatically.',
        'اعلان‌های کامیونیتی را چطور بگیرم؟', 'زنگ اعلان، فعالیت‌هایی مثل پاسخ، لایک، دنبال‌کردن و پیام را داخل برنامه نشان می‌دهد. برای اعلان دستگاه باید از کنترل اعلان فعال‌سازی کنید و مجوز مرورگر بدهید؛ این قابلیت خودکار فعال نمی‌شود.'),
      entry('Will notifications arrive if the site is closed?', 'Background delivery depends on browser and device support, permissions and a valid push subscription. On iPhone you may need to add the website to your Home Screen first. If delivery stops after changing devices or browser data, enable notifications again; actual closed-app delivery can vary.',
        'وقتی سایت بسته است اعلان می‌رسد؟', 'تحویل در پس‌زمینه به پشتیبانی دستگاه و مرورگر، مجوزها و اشتراک معتبر اعلان وابسته است. در آیفون ممکن است نخست نیاز به افزودن سایت به صفحه اصلی باشد. پس از تعویض دستگاه یا پاک‌کردن داده مرورگر، اعلان را دوباره فعال کنید؛ دریافت در حالت بسته ممکن است متفاوت باشد.'),
      entry('Do lock-screen messages reveal private chats?', 'Push notifications for direct messages use generic wording rather than displaying the private message body. Open the app to read the actual conversation.',
        'آیا متن چت خصوصی روی صفحه قفل دیده می‌شود؟', 'اعلان‌های پیام خصوصی متن عمومی دارند و محتوای پیام را روی صفحه قفل نمایش نمی‌دهند. برای خواندن گفت‌وگو برنامه را باز کنید.'),
    ],
  },
  {
    id: 'privacy', title: { en: 'Profile, privacy & safety', fa: 'پروفایل، حریم خصوصی و امنیت' }, items: [
      entry('How do I change my name or picture?', 'Open Settings for your account profile. You can select an avatar or upload a profile picture; if you have not chosen a picture, Persian Dark Horse displays a default avatar. Your chosen picture is not replaced by that default.',
        'نام یا تصویرم را چگونه تغییر دهم؟', 'برای پروفایل حساب به تنظیمات بروید. می‌توانید آواتار انتخاب کنید یا تصویر پروفایل بارگذاری کنید؛ اگر تصویری انتخاب نکرده باشید، تصویر پیش‌فرض نمایش داده می‌شود. تصویر انتخابی شما با پیش‌فرض جایگزین نمی‌شود.'),
      entry('What does my public Community profile show?', 'It can show your display name, avatar, a bio and public links you explicitly add, follow counts, and intentionally published creations. Private AI personalization, instructions and chat history are not public profile content.',
        'پروفایل عمومی کامیونیتی چه چیزی نشان می‌دهد؟', 'ممکن است نام نمایشی، آواتار، زندگی‌نامه و لینک‌های عمومیِ افزوده‌شده توسط خودتان، تعداد دنبال‌کنندگان و آثار منتشرشده عمدی را نشان دهد. شخصی‌سازی خصوصی هوش مصنوعی، دستورالعمل‌ها و تاریخچه چت محتوای پروفایل عمومی نیستند.'),
      entry('Where are my personal preferences and memories?', 'Settings and Personalization contain account preferences and memory controls. Review and change saved information there. Do not put sensitive information in public posts, public agent descriptions or shared prompts.',
        'ترجیحات و حافظه شخصی من کجاست؟', 'تنظیمات و شخصی‌سازی شامل ترجیحات حساب و کنترل‌های حافظه است. اطلاعات ذخیره‌شده را همان‌جا مرور و تغییر دهید. اطلاعات حساس را در پست عمومی، توضیح ایجنت عمومی یا پرامپت اشتراکی قرار ندهید.'),
      entry('Should I share my password, wallet recovery phrase or API key with support?', 'No. Never send passwords, recovery phrases, private keys or secret API keys in Community, tickets or messages. Describe the error and provide non-secret identifiers such as a ticket number or transaction ID instead.',
        'رمز، عبارت بازیابی یا کلید API را برای پشتیبانی بفرستم؟', 'نه. رمز، عبارت بازیابی، کلید خصوصی یا کلید محرمانه API را در کامیونیتی، تیکت یا پیام نفرستید. خطا و شناسه‌های غیرمحرمانه مانند شماره تیکت یا شناسه تراکنش را توضیح دهید.'),
    ],
  },
  {
    id: 'support', title: { en: 'Help & troubleshooting', fa: 'راهنما و رفع مشکل' }, items: [
      entry('How do I contact support?', 'Open Support and send a ticket with a subject, contact method and clear description. Choose the question, payment, technical or collaboration type. The confirmation displays a ticket ID; keep it for follow-up.',
        'چگونه با پشتیبانی تماس بگیرم؟', 'پشتیبانی را باز کنید و تیکتی با موضوع، راه تماس و شرح روشن بفرستید. نوع پرسش، پرداخت، فنی یا همکاری را انتخاب کنید. پس از پذیرش، شناسه تیکت نمایش داده می‌شود؛ برای پیگیری نگهش دارید.'),
      entry('What should I include in a payment issue?', 'Include the plan or credit product, network, asset, approximate time, transaction ID and what the checkout showed. Do not include a wallet recovery phrase, private key or secret API key. Sending a support ticket does not itself verify a payment.',
        'برای مشکل پرداخت چه اطلاعاتی بدهم؟', 'نام پلن یا محصول اعتباری، شبکه، ارز، زمان تقریبی، شناسه تراکنش و آنچه صفحه پرداخت نشان داده را بنویسید. عبارت بازیابی، کلید خصوصی یا کلید محرمانه API را نفرستید. ارسال تیکت به‌تنهایی پرداخت را تأیید نمی‌کند.'),
      entry('What if a feature is unavailable or a request fails?', 'Check your sign-in status, plan or API entitlement, balance, permissions and connection. Read the on-screen error, then retry once if the issue appears temporary. For repeated problems, send Support the page, action and error message without secrets.',
        'اگر قابلیتی کار نکرد یا درخواست شکست خورد چه کنم؟', 'ورود به حساب، دسترسی پلن یا API، موجودی، مجوزها و اینترنت را بررسی کنید. پیام خطا را بخوانید و اگر موقت بود یک‌بار دوباره تلاش کنید. برای مشکل تکراری، صفحه، عملیات و متن خطا را بدون اطلاعات محرمانه به پشتیبانی بفرستید.'),
    ],
  },
];