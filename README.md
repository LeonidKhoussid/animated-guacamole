<div align="center">
  <img src="https://i.slow.pics/WBmWYYso.png" alt="PlanAI Logo" width="1600"/>
</div>

# **PlanAI-ML**

<p style="text-align: center;">На этой ветке лежит ML-часть проекта PlanAI. В настоящее время она находится на стадии альфа-версии, поэтому функциональность и производительность могут существенно измениться по мере разработки.

  `Главная фича` — AI-консультант по перепланировке квартир, который работает в режиме реального времени: преобразует речь в текст, анализирует запросы с помощью языковой модели, предоставляет профессиональные консультации с указанием нормативных документов (ЖК РФ, ПП №508-ПП), синтезирует ответы обратно в речь. Система автоматически извлекает данные из документов ЕГРН, обрабатывает планы квартир, детектирует стены и комнаты, векторизует планы, генерирует 3D-модели и создает визуализации интерьеров.
</p>

---

### **Преимущества**

- **Понимание контекста**: Архитектура построена на базе моделей `LLaMA`, что позволяет глубоко понимать контекст диалогов и естественно общаться с пользователем
- **Мультимодальность**: Поддержка текста, изображений, аудио, PDF, SVG и 3D-моделей в едином конвейере
- **Гибкость**: Модульная архитектура позволяет легко добавлять новые модели и функции
- **Plug-&-Play**: всё что нужно пользователю находится в 1 месте, все модели работают конвеером

---

### **Обзор Пайплайна**

1. **Импорт и обработка документов:**

   - Пользователь загружает PDF-файл выписки из ЕГРН
   - `pdfplumber` и `PyPDF2` извлекают текст из PDF
   - OCR `TrOCR-base-printed` распознает текст на изображениях
   - `EGRNExtractor` парсит документ и извлекает структурированные данные (кадастровый номер, адрес, площадь, стоимость и т.д.)
   - Результат сохраняется в JSON и автоматически загружается в базу данных

2. **Обработка планов квартир:**

   - `TrOCR-base-printed` извлекает текстовую информацию с плана
   - `MMDetection` (Cascade R-CNN / Mask R-CNN) детектирует стены и комнаты, возвращает `bounding boxes`
   - `PlanTrassing` векторизует план: бинаризация, выделение стен, создание масок (NPY), генерация векторного представления

3. **Генерация 3D-моделей:**

   - `svgelements` парсит SVG пути
   - `shapely` обрабатывает линии и полигоны (буферизация, объединение)
   - `trimesh` создает 3D меши: экструзия 2D полигонов в 3D объекты (стены), триангуляция, экспорт OBJ

4. **Сегментация и генерация интерьеров:**

   - `UPerNet` (Transformer + CNN) выполняет семантическую сегментацию интерьеров
   - `Stable Diffusion Inpainting` генерирует новые интерьеры по текстовому промпту
   - `ControlNet` управляет генерацией с помощью карты сегментации
   - `UniPCMultistepScheduler` оптимизирует процесс диффузии (ускоряет в 2-3 раза)
   - `PromptGenerator` (с `deep-translator`) переводит текст в промты промпты

5. **Голосовое взаимодействие (STT → LLM → TTS):**

   - Голос записывается с автоматическим обрезанием пауз (таймер «молчания»)
   - `torchaudio` выполняет ресемплинг и нормализацию аудио
   - `Whisper-base` (OpenAI) преобразует аудиодорожку в текст — с поддержкой нескольких языков
   - Распознанный текст передается на вход в ламу `Meta-Llama-3-8B-Instruct.Q4_0`
   - `gpt4all` менеджер для LLM модели (контекст: 8192 токенов)
   - `Silero TTS v5_cis_base` генерирует естественную речь (голос `ru_alfia` / `ru_zhadyra`), поддерживает base notes (`+`) и ударения (`'`)

---

### **Технологии**

| Категория | Библиотеки | Описание |
|-----------|------------|----------|
| **ML Framework** | PyTorch, torchvision, torchaudio | Основной фреймворк для обучения и запуска моделей |
| **Детекция объектов** | mmdet, mmcv | MMDetection для детекции стен и комнат на планах |
| **Диффузионные модели** | diffusers, transformers | Stable Diffusion Inpainting, ControlNet, UPerNet, UniPCMultistepScheduler |
| **Обработка изображений** | opencv-python, Pillow, numpy | Компьютерное зрение, бинаризация, морфологические операции |
| **Геометрия и 3D** | trimesh, shapely, svgelements | Триангуляция, экструзия полигонов, работа с геометрией |
| **STT** | whisper, openai-whisper | Распознавание речи от OpenAI |
| **LLM** | gpt4all, langchain | Локальные LLM модели (GGUF формат) |
| **TTS** | Silero TTS v5 | Синтез речи с поддержкой base notes и ударений |
| **NLP** | nltk, spacy, deep-translator | Обработка текста, перевод промптов |
| **Документы** | pdfplumber, PyPDF2 | Парсинг PDF документов |

**Модельки:**
- `Stable Diffusion Inpainting` — диффузионная модель для генерации интерьеров
- `ControlNet` — управление генерацией с помощью карт сегментации
- `UPerNet` — архитектура Transformer + CNN для семантической сегментации
- `UniPCMultistepScheduler` — планировщик шагов диффузии для ускоренной генерации
- `Whisper` — распознавание речи
- `Meta-Llama-3-8B-Instruct.Q4_0` — llama для общения
- `Silero TTS v5_cis_base` — синтез речи

---

#### **Пример далога:**

```
| User_input|
|--------------------------|
| Привет! Я хочу присоеденить лоджию к своей спальне. Можешь объяснить подробнее как это сделать, что можно, что нельзя и какие есть ограничения?|

| Assistant_output|
|--------------------------|
| Здравствуйте! К сожалению, согласно Жилищному кодексому РФ (статьи 25-29): запрещено полностью объединять жилое пространство с лоджией например, переносить батареи отопления на лоджию или организовывать тёплый водяной пол от отопительного контура дома. Штрафы и последствия: Самовольное переустройство или перепланировка — административная ответственность по КоАП РФ ст.7.21: 1) Штраф для граждан: от 2 000 до 2 500 рублей. 2) Штраф для должностных лиц: от 4 000 до 5 000 рублей. 3) Штраф для юридических лиц: от 40 000 до 50 000 рублей. Однкао разрешено: 1) Остекление лоджии или балкона, если не изменяются габариты проёмов и не нарушается фасад. 2) Утепление внутренними материалами (минеральная вата, пенополистирол, современные панели). 3) Использование электрических систем обогрева (конвекторы, инфракрасные панели, электрический «тёплый пол»).|
```
---

#### Генерация интерьеров (Style Diffusion)

| Input | Mask | Result 01 | Result 02 |
|-------|------|-----------|-----------|
| <div align="center"><img src="https://i.slow.pics/1jzAIWuQ.jpg" alt="Input Image" width="250"/></div> | <div align="center"><img src="https://i.slow.pics/tCrLLHZK.png" alt="Segmentation Mask" width="250"/></div> | <div align="center"><img src="https://i.slow.pics/5Er6cFAi.jpg" alt="Result 01" width="250"/></div> | <div align="center"><img src="https://i.slow.pics/JtCm9BPU.jpg" alt="Result 02" width="250"/></div> |

---

## **Архитектура**

```
Пользователь
    ↓
FastAPI Backend
    ↓
ML Service (inference_api.py, ml_pipeline.py)
    ↓
┌─────────────────────────────────────────┐
│  Modeling                                │
│  - BBoxDetector (MMDetection)           │
│  - OCRExtractor (TrOCR)                 │
│  - ControlNetSegmentation               │
│  - StyleDiffusionV2                     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Utils                                  │
│  - EGRNExtractor                        │
│  - SVGWalls3D (trimesh)                 │
│  - PlanTrassing                          │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Audio Processing                       │
│  - AudioToText (Whisper)                │
│  - TextToSpeech (Silero TTS v5)         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  LLM Agent                              │
│  - LlamaGGUFModel (Meta Llama 3)        │
│  - DialogManager                         │
│  - PromptRouting                         │
└─────────────────────────────────────────┘
    ↓
PostgreSQL DB
```

### Структура проекта

```
/PlanAI/
│
├─ .gitattributes
├─ .gitignore
│
├─ main.py
├─ config.py
├─ fast_api.bash
│
├─ api
│  ├─ __init__.py
│  ├─ routes.py
│  └─ schemas.py
│
├─ bonus
│  ├─ make_tree.ps1
│  └─ make_tree_run.bat
│
├─ data
│  ├─ diffusion
│  │  ├─ input
│  │  └─ output
│  ├─ egrn_prop
│  ├─ llm_session
│  └─ plans
│     ├─ bboxes
│     ├─ croped
│     ├─ normalized
│     ├─ raws
│     └─ vectors
│
├─ db_connector
│  ├─ __init__.py
│  ├─ crud
│  ├─ engine.py
│  ├─ db_schemas.py
│  └─ db_models.py
│
├─ ml_service
│  ├─ __init__.py
│  ├─ ml_pipeline.py
│  ├─ inference_api.py
│  │
│  ├─ audio_processing
│  │  ├─ __init__.py
│  │  ├─ to_audio.py
│  │  ├─ to_text.py
│  │  └─ vocal_selector.py
│  │
│  ├─ llama_agent
│  │  ├─ __init__.py
│  │  ├─ agent_core
│  │  │  ├─ __init__.py
│  │  │  ├─ factory.py
│  │  │  ├─ llma.py
│  │  │  └─ run_agent.py
│  │  ├─ dialog_manager.py
│  │  ├─ llama_response.py
│  │  └─ prompt_engineer.py
│  │
│  ├─ modeling
│  │  ├─ __init__.py
│  │  ├─ bbox_detector.py
│  │  ├─ ocr.py
│  │  ├─ segmentation.py
│  │  └─ style_diffusion_v2.py
│  │
│  └─ utils
│     ├─ __init__.py
│     ├─ egrn_extractor.py
│     ├─ img_norm.py
│     ├─ plan_to_vec.py
│     ├─ prompt_gen.py
│     ├─ walls_3d.py
│     └─ wrapper.py
│
├─ models
│  ├─ mdx_net
│  ├─ meta_llama
│  ├─ mmdetection
│  │  └─ weights
│  ├─ nlp
│  │  ├─ nltk_data
│  │  ├─ spacy_model_en
│  │  └─ spacy_model_ru
│  ├─ silero_tts
│  ├─ style_diffusion
│  ├─ trocr-base-printed
│  └─ whisper
│
├─ requirements.txt
└─ structure.txt
```
