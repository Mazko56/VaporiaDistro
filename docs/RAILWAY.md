# ПОКРОКОВИЙ ДЕПЛОЙ VAPORIA DISTRO НА RAILWAY (Windows)

## 0. Що вам потрібно

1. [Node.js](https://nodejs.org/) 22+ (для локальних запусків) та [Git for Windows](https://git-scm.com/).
2. Акаунти [GitHub](https://github.com/), [Railway](https://railway.com/) і Telegram.
3. Створений Telegram-бот через **@BotFather** (команда `/newbot`), його `BOT_TOKEN` — **нікому не надсилати**.
4. Ваш числовий Telegram ID: після деплою напишіть своєму боту `/myid`.

## 1. Розпакувати архів і завантажити у GitHub

Розпакуйте весь архів в `C:\vaporia-distro` — файли `package.json`, `server`, `src`, `public`, `railway.json` мають лежати **безпосередньо** в цій папці.

Створіть на GitHub **порожній** репозиторій, наприклад `vaporia-distro` (можна приватний). У PowerShell:

```powershell
cd C:\vaporia-distro
git init
git branch -M main
git add .
git commit -m "Initial Vaporia Distro Telegram Mini App"
git remote add origin https://github.com/ВАШ_USERNAME/vaporia-distro.git
git push -u origin main
```

**Ніколи не виконуйте `git add .env`**. `.gitignore` вже виключає `.env` і залежності.

Після кожної зміни:

```powershell
cd C:\vaporia-distro
git add .
git commit -m "Update Mini App"
git push origin main
```

## 2. Railway: створити проект

1. Railway → **New Project** → **Deploy from GitHub repo** → `vaporia-distro`.
2. Додайте в цьому самому Railway-проєкті ще один сервіс: **+ New → Database → PostgreSQL**.
3. Назвіть БД `Postgres`, щоб змінна у прикладі спрацювала; якщо назва інша, скоригуйте посилання.
4. У вебсервісі (код з GitHub) відкрийте **Settings → Networking → Generate Domain**. Скопіюйте адресу виду `https://vaporia-....up.railway.app`. Сервіс може бути нездоровий до налаштування Variables — це нормально.

## 3. Railway → ВЕБСЕРВІС → Variables

Задайте такі змінні (приклади значень, **секрети вигадуйте свої**):

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
BOT_TOKEN=ВАШ_ТОКЕН_ВІД_BOTFATHER
PUBLIC_URL=https://ВАШ-ДОМЕН.up.railway.app
SESSION_SECRET=ВАШ_ВИПАДКОВИЙ_РЯДОК_64_СИМВОЛИ
WEBHOOK_SECRET=ВАШ_ІНШИЙ_ВИПАДКОВИЙ_РЯДОК_32_СИМВОЛИ
ADMIN_TELEGRAM_IDS=123456789
ADMIN_CHAT_ID=
SEED_DEMO_DATA=true
DEV_AUTH_ENABLED=false
BONUS_PERCENT=5
STORE_NAME=VAPORIA DISTRO
ENABLE_CHECKOUT=false
REQUIRE_VERIFIED_AGE=true
```

**УВАГА:** `${{Postgres.DATABASE_URL}}` — це синтаксис **Railway Reference Variable**, а не Windows PowerShell. Якщо сервіс БД називається інакше, замініть `Postgres` на реальну назву.

Згенерувати секрети на Windows з Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Виконайте двічі. Для `WEBHOOK_SECRET` використовуйте лише `a-z`, `A-Z`, `0-9`, `_`, `-` (згенерований hex підходить).

`ADMIN_TELEGRAM_IDS` — один або декілька числових ID через кому, **без `@`**. До отримання правильного ID можна залишити порожньо, але адмінка тоді недоступна. Після деплою напишіть боту `/myid`, внесіть ID і redeploy.

`ADMIN_CHAT_ID` — optional. Для повідомлень у приватну групу додайте туди бота, дайте йому відповідні дозволи і встановіть ID групи; без цього клієнту сповіщення надходитимуть, але окрема копія адміну — ні.

### Важливі прапорці

- **`SEED_DEMO_DATA=true`**: на першому старті з'являться зразки товарів, категорій, банери, промокод `WELCOME5`. Перед продажем замініть демонстраційні ціни/описи/наявність; потім можна встановити `false` (дані **не видаляться**).
- **`ENABLE_CHECKOUT=false`**: оформлення реальних заявок вимкнене, поки не перевірено юридичні вимоги.
- **`REQUIRE_VERIFIED_AGE=true`**: якщо згодом увімкнути checkout, замовити зможе лише клієнт, вік якого був перевірений належним способом і який відмічений адміністратором. Самодекларації `18+` недостатньо.

## 4. Build / Deploy

`railway.json` налаштовано у репозиторії:

- Build: `npm install --include=dev && npm run build`
- Start: `npm run start`
- Healthcheck: `/api/health`

Натисніть **Deploy / Redeploy** у Railway. У Logs має бути:

```text
Database schema ready
Demo catalog initialized (existing edits preserved)
Telegram webhook and menu button configured
VAPORIA server on port ...
```

Бренд у клієнтському інтерфейсі VAPORIA DISTRO. Якщо ви змінили `BOT_TOKEN`, `PUBLIC_URL` чи `WEBHOOK_SECRET`, зробіть Redeploy, щоб webhook налаштувався повторно.

Railway сам задає `PORT`; **не потрібно** вручну вказувати порт 3000 у Variables.

## 5. Перевірити Telegram

1. Відкрийте бота в Telegram → `/start`.
2. Має з'явитися кнопка **«Відкрити VAPORIA DISTRO»**; також іконка меню Web App.
3. Відкрийте магазин із Telegram → підтвердьте 18+ (демо-самодекларація) → категорії, продукти, профіль, бонуси.
4. Напишіть боту `/myid` → додайте цей ID у `ADMIN_TELEGRAM_IDS` → Redeploy → у «Профіль» з'явиться «Адмінпанель».
5. Адмінпанель → додайте власні товари, SKU, ціни в гривнях, залишки, фото через прямі HTTPS URL.
6. Перевірка: `https://ВАШ-ДОМЕН.up.railway.app/api/health` має віддати `{ "ok": true, ... }`.

**Не налаштовуйте вручну `getUpdates` polling одночасно з webhook**. Один вебсервіс already handles API + bot webhook.

## 6. Якщо виникають помилки

- **`DATABASE_URL is required`** — не додано Reference Variable або Postgres ще не працює.
- **`PUBLIC_URL must be a full HTTPS URL`** — вказали адресу без `https://` або не згенерували Railway domain.
- **`SESSION_SECRET...` / `WEBHOOK_SECRET...`** — неправильна довжина ключа.
- **Помилка Bot API 401** — неправильний BOT_TOKEN. Змініть токен у Railway й redeploy.
- **`Telegram initData` invalid** — спроба відкрити напряму у браузері поза Telegram чи дані застаріли. Відкрийте через `/start` у Telegram.
- **Немає таблиць** — прочитайте Logs на старті; `migrate()` має виконатися до запуску сервера.
- **Немає товарів** — встановіть SEED_DEMO_DATA=true та redeploy або додайте товари вручну після створення категорій.
- **Сайт відкривається, але не оформляється** — за замовчуванням це навмисно. Читайте `docs/LEGAL_LAUNCH.md`, і лише після відповідних процедур керуйте `ENABLE_CHECKOUT`.
- **Не завантажуються картинки** — використовуйте прямі публічні HTTPS URL файлів JPEG/PNG/WebP, не посилання на сторінку. Є стильний запасний макет товару.
- **Пропали дані після redeploy** — перевірте, чи `DATABASE_URL` постійно вказує на ТУ Ж САМУ PostgreSQL; не створюйте нову БД при кожному деплої.

## 7. Особливості Railway

Вебсервіс і Postgres — різні сервіси у **одному Railway project**. Web service можна redeploy без очищення DB. Не ставте Dockerfile. Якщо хочете видалити демонстраційні позиції — приховайте їх у адмінці або видаліть вручну з БД після резервної копії.

Джерела: [Railway PostgreSQL](https://docs.railway.com/databases/postgresql), [Build/Start commands](https://docs.railway.com/builds/build-and-start-commands), [Reference Variables](https://docs.railway.com/variables/reference), [Telegram Mini Apps validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
