# PlanAI Frontend

Интерфейс для веб‑приложения PlanAI: загрузка планов, общение с ИИ, просмотр 3D моделей и управление вариантами перепланировки.

## Технологический стек
- React + Vite
- Tailwind CSS
- Three.js (GLTF/Draco/Meshopt)
- Axios
- React Router

## Основной функционал
- Загрузка плана квартиры и запуск генерации вариантов через ИИ.
- Чат с потоковым получением вариантов (WebSocket) и сохранением истории.
- Просмотр вариантов: карточки, детальная страница, 3D/топ/первое лицо (Three.js), избранное.
- Избранное: добавление/удаление, просмотр списка.
- Навигация по разделам (нижнее меню).

## Быстрый старт
```bash
cd frontend
npm install
npm run dev
```
Откройте `http://localhost:5173` (по умолчанию).

### Переменные окружения
Создайте `.env` (или `.env.local`) и задайте:
```
VITE_API_BASE_URL=http://localhost:3001
```

## Структура
```
src/
  components/    # UI и 3D (ThreeDViewer, VariantCard, Chat)
  pages/         # Страницы (ChatAIPage, VariantViewerPage, Dashboard, Favorites)
  hooks/         # WebSocket
  utils/         # apiClient, загрузка файлов
```

## Скрипты
- `npm run dev` — режим разработки
- `npm run build` — сборка
- `npm run preview` — предпросмотр сборки

## Примечания по 3D
- Загрузка моделей GLB через прокси бекенда `/plans/proxy` (обходит CORS).
- Поддержка Draco/Meshopt для ускорения загрузки.
- Режимы камеры: 3D орбита, топ, первое лицо (WASD + джойстик).
