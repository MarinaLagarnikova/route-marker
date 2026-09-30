# Вешка Android — дизайн-документ

## Концепция

Гибридное Android-приложение: WebView (текущий веб-UI без изменений) + нативный Kotlin-слой для функций, недоступных в браузере.

## Архитектура

```
┌─────────────────────────────────┐
│         Android App             │
│                                 │
│  ┌───────────────────────────┐  │
│  │        WebView            │  │
│  │  (текущий веб-сайт)       │  │
│  │  UI, карта, логика,       │  │
│  │  localStorage             │  │
│  └─────────┬─────────────────┘  │
│            │ JS Bridge          │
│  ┌─────────┴─────────────────┐  │
│  │     Kotlin Native Layer   │  │
│  │  - Foreground GPS Service │  │
│  │  - Автоотметка в фоне     │  │
│  │  - Детекция схода         │  │
│  │  - Вибрация + звук        │  │
│  │  - Share Intent           │  │
│  │  - File Intent (.gpx)     │  │
│  │  - Уведомления            │  │
│  │  - Assets (GPX библиотека)│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Что работает в WebView без изменений

Весь текущий веб-код:
- Все экраны: главная, маршрут, коллекции, завершённые
- Парсинг GPX (DOMParser)
- Кольцевые маршруты (3 фазы)
- Автоопределение направления
- Ручная отметка точек
- Прогресс (пройдено / осталось / прогноз финиша)
- История прохождения (HistoryDrawer)
- Избранное / «Хочу пройти» / добавление на главную
- Список чекпоинтов
- Карта (MapTiler SDK в WebView)
- Конфетти при финише
- Сортировка, фильтрация коллекций
- localStorage для хранения прогресса

## Что пишется нативно (Kotlin)

### 1. Foreground GPS Service
- `LocationManager` / Fused Location Provider
- Работает при свёрнутом приложении и заблокированном экране
- Постоянное уведомление (требование Android для foreground service)
- Передаёт координаты в WebView через JS Bridge

### 2. Автоотметка в фоне
Логика из `useGpsAutoMark.ts`:
- Точность GPS <= 50м
- Скорость <= 15 км/ч (фильтр транспорта)
- Радиус 30м от следующей точки
- Задержка 3 секунды (dwell)
- После отметки — уведомление

### 3. Детекция схода с маршрута
Логика из `useOffRouteDetect.ts`:
- Расстояние до ближайшей точки трека > 100м
- Стабильное отклонение 20 секунд
- Вибрация + звуковой сигнал (3 бипа: сразу, +30с, +60с)
- Уведомление при сходе

### 4. Шаринг GPX
- Android Share Intent
- Файл GPX как attachment
- Заголовок = название маршрута

### 5. Открытие GPX-файлов
- Intent-filter для `.gpx` файлов
- Пользователь тапает GPX в файловом менеджере → открывается Вешка
- Файл передаётся в WebView через JS Bridge

### 6. Библиотека маршрутов из assets
- `assets/routes.json` — метаданные всех маршрутов
- `assets/tracks/*.gpx` — GPX-файлы
- JS Bridge: WebView запрашивает файл → Kotlin читает из assets → отдаёт
- Обновление библиотеки = новая версия приложения в Google Play

### 7. JS Bridge (WebAppInterface)
Kotlin → JS:
- `onGpsPosition(lat, lon, accuracy, speed)` — обновление GPS
- `onCheckpointAutoMarked(index)` — точка отмечена в фоне
- `onOffRouteAlert()` — сход с маршрута

JS → Kotlin:
- `startTracking(checkpointsJson)` — начать фоновый GPS с координатами точек
- `stopTracking()` — остановить GPS
- `shareGpx(gpxXml, routeName)` — шаринг
- `openFilePicker()` — открыть выбор GPX-файла
- `getAssetFile(path)` — получить файл из assets
- `getRoutesList()` — получить routes.json из assets

### 8. Уведомления
- Постоянное уведомление при активном трекинге (требование Android)
- Уведомление при автоотметке точки
- Уведомление при сходе с маршрута

## Хранение данных

- **Прогресс, избранное, pinned** — localStorage в WebView (как в вебе)
- **Библиотека маршрутов** — assets в APK (read-only)
- **Пользовательские GPX** — localStorage в WebView

## Изменения в веб-коде

Минимальные — добавить обнаружение Android-окружения:
- `library-api`: если Android → запрашивать файлы через JS Bridge вместо fetch
- `upload-gpx`: если Android → вызывать нативный file picker через JS Bridge
- `mark-checkpoint`: если Android → GPS-данные приходят через JS Bridge
- `route-header`: если Android → шаринг через JS Bridge
- Всё остальное работает без изменений

## Что НЕ делаем

- Многоэтапные маршруты (убраны)
- Офлайн-карты (на потом)
- Нативный UI (весь UI в WebView)
- Room / SQLite (используем localStorage)
- Бэкенд / синхронизация
- Авторизация / аккаунты

## Структура Android-проекта

```
veshka-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/veshka/app/
│   │   │   ├── MainActivity.kt          — WebView + JS Bridge
│   │   │   ├── GpsTrackingService.kt     — Foreground Service
│   │   │   ├── AutoMarkEngine.kt         — логика автоотметки
│   │   │   ├── OffRouteDetector.kt       — детекция схода
│   │   │   ├── WebAppInterface.kt        — JS Bridge
│   │   │   ├── ShareHelper.kt            — Share Intent
│   │   │   └── FilePickerHelper.kt       — открытие GPX
│   │   ├── assets/
│   │   │   ├── web/                      — билд веб-приложения
│   │   │   ├── routes.json               — метаданные библиотеки
│   │   │   └── tracks/                   — GPX-файлы библиотеки
│   │   ├── res/
│   │   │   ├── drawable/                 — иконки
│   │   │   ├── mipmap/                   — иконка приложения
│   │   │   └── values/                   — строки, цвета
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/
├── CLAUDE.md                             — инструкции для Claude
└── README.md                             — инструкция для сборки
```

## Процесс разработки

1. Создать Android-проект (Gradle + Kotlin + Jetpack)
2. Настроить WebView с веб-билдом в assets
3. Реализовать JS Bridge
4. Реализовать Foreground GPS Service
5. Перенести логику автоотметки в Kotlin
6. Перенести логику детекции схода в Kotlin
7. Реализовать шаринг и file picker
8. Зашить библиотеку маршрутов в assets
9. Адаптировать веб-код (обнаружение Android, вызовы Bridge)
10. Настроить иконку, splash screen, manifest
11. Написать README с инструкцией для сборки и публикации

## Инструкция для мужа (README)

1. Установить Android Studio
2. Клонировать репозиторий
3. Открыть проект в Android Studio
4. Подождать синхронизацию Gradle
5. Подключить телефон или запустить эмулятор
6. Run → запустить на устройстве
7. Проверить основные функции
8. Build → Generate Signed APK/Bundle
9. Загрузить в Google Play Console
