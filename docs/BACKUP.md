# РЕЗЕРВНІ КОПІЇ POSTGRESQL

**В архіві немає налаштованого автоматичного бекапу.** Збереження у PostgreSQL переживає звичайні redeploy, але це **не** захист від видалення таблиць, злому чи втрати самої БД.

## Рекомендований режим

1. Окреме сховище **Cloudflare R2 / S3** (не той самий Railway-проєкт).
2. Щоденний повний дамп Postgres (`pg_dump -Fc`), зберігати 14–30 днів.
3. Перевірка відновлення на окрему test-БД щомісяця.
4. Шифрувати дампи й обмежити доступ до credentials.

## Приклад ручного бекапу

На машині, де встановлений **PostgreSQL client** та є мережевий доступ до БД:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --file "vaporia_$(date +%Y%m%d_%H%M).dump"
```

Для зовнішнього підключення до Railway PostgreSQL можуть знадобитися **Public Networking / TCP Proxy** і змінна `DATABASE_PUBLIC_URL` (див. документацію Railway). Не комітьте бекапи в Git.

Відновлення **в окрему порожню базу**:

```bash
pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL" "назва.dump"
```

Автоматичне розміщення R2 — окреме завдання: Railway cron / GitHub Actions / зовнішній сервер з S3-compatible клієнтом і обмеженим доступом. Не запускати backup job у тому самому Node-процесі без планувальника та моніторингу.
