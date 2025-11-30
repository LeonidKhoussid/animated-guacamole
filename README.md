# PlanAI — Перепланировка с ИИ

Комплексное приложение: фронтенд на React/Three.js и backend на Fastify/PostgreSQL. Позволяет загружать планы квартир, общаться с ИИ, получать варианты перепланировки, просматривать их в 3D, сохранять избранное и подавать заявки.

## Технологический стек

- **Frontend:** React + Vite, Tailwind CSS, Three.js (GLTF/Draco/Meshopt), Axios, React Router.
- **Backend:** Node.js + Fastify, PostgreSQL + Prisma, JWT, Yandex S3 (или локальное хранение), WebSocket, Swagger/OpenAPI.
- **AI:** основная ML‑модель с резервом, стриминг прогресса по WebSocket.

## Основной функционал

- Загрузка планов (PNG/JPG/PDF), запуск ИИ‑генерации вариантов, чат с сохранением истории.
- Просмотр вариантов: карточки, детальная страница, 3D/топ/первое лицо, анализ несущих стен.
- Избранное: добавление/удаление, список избранных.
- Подача заявок в БТИ и админ‑панель для решений по заявкам.

## Быстрый старт

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
cp .env.example .env   # заполните переменные, см. ENV_SETUP.md
npm run prisma:migrate
npm run prisma:generate
npm run dev            # или npm start
```

Frontend по умолчанию на `http://localhost:5173`, backend на `http://localhost:3001` (Swagger `/docs`).

## Структура

- `frontend/` — UI, чат, 3D‑просмотр, избранное, навигация.
- `backend/` — API, auth, AI запросы, планы, варианты, избранное, заявки, админ.
- `prisma/` — схема и миграции БД.

Подробности см. в `frontend/README.md` и `backend/README.md`.
