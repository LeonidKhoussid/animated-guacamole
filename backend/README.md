# PlanAI Backend API

Backend для PlanAI — сервиса перепланировки квартир с ИИ, потоковой генерацией вариантов и проверкой норм.

## Технологический стек

- Node.js, Fastify
- PostgreSQL + Prisma ORM
- JWT аутентификация
- Yandex S3 (или локальное хранение) для планов и моделей
- WebSocket для стриминга прогресса
- Swagger/OpenAPI

## Основной функционал

- Аутентификация пользователей и админов.
- Загрузка планов (PNG/JPG/PDF).
- Запуск ИИ‑запросов, генерация вариантов (основная ML‑модель + резервный режим).
- История запросов, получение вариантов, публичные ссылки на варианты.
- Избранное: добавление, просмотр, удаление.
- Заявки в БТИ, статусы, админ‑решения.
- Админ API для заявок.

## Быстрый старт

```bash
cd backend
npm install
cp .env.example .env   # заполните переменные
npm run prisma:migrate
npm run prisma:generate
npm run dev            # или npm start
```

Сервер: `http://localhost:3001`, Swagger: `http://localhost:3001/docs`.

## Ключевые эндпоинты

- `POST /auth/register`, `POST /auth/login`, `POST /admin/login`
- `POST /plans/upload`, `GET /plans/:id`, `GET /plans/proxy`
- `POST /ai/request`, `GET /ai/history`, `GET /ai/requests/:id`, `GET /ai/stream/:request_id`
- `GET /variants/:id`, `GET /share/:variant_id`
- `POST /favorites`, `GET /favorites`, `DELETE /favorites/:variant_id`
- `POST /applications`, `GET /applications/:id`
- `GET /admin/applications`, `GET /admin/applications/:id`, `POST /admin/applications/:id/decision`

## Структура

```
src/
  controllers/   # обработчики маршрутов
  services/      # бизнес-логика
  routes/        # fastify-маршруты
  middleware/    # auth и др.
  models/        # prisma клиент
  server.js      # точка входа
prisma/          # схема и миграции
uploads/         # локальное хранение (если не S3)
```

## Переменные окружения

См. `ENV_SETUP.md` для полного списка (DB, JWT, S3, ML).

## Скрипты

- `npm run dev` — dev сервер с автоперезапуском
- `npm start` — продакшн
- `npm run prisma:migrate` — миграции
- `npm run prisma:generate` — генерация Prisma client
