# Дизайн: наполнение библиотеки маршрутов

## Проблема

Все коллекции и маршруты — заглушки. Источник данных: rutrail.org (разрешение получено).

## Решение

### Хранение файлов

```
public/tracks/
  rutrail-logo.png
  moscow-region/
    collection.json
    borovsk-loop.gpx
    another-route.gpx
  caucasus-crimea/
    collection.json
    ...
```

### Схема `collection.json`

```json
{
  "id": "moscow-region",
  "name": "Москва и область",
  "routes": [
    {
      "id": "borovsk-loop",
      "name": "Боровский кольцевой маршрут",
      "gpx": "borovsk-loop.gpx",
      "region": "Московская область",
      "distanceKm": 42.5,
      "durationLabel": "2—3 дня",
      "difficulty": "medium",
      "elevationGainM": 380,
      "type": "loop",
      "nearestSettlement": "Боровск",
      "description": "1–2 предложения о характере местности и особенности маршрута.",
      "highlights": ["лес", "река", "нет бродов"],
      "source": {
        "name": "RuTrail",
        "url": "https://rutrail.org/...",
        "logoUrl": "/tracks/rutrail-logo.png"
      },
      "trackSimplified": [
        { "lat": 55.21, "lon": 36.49 },
        { "lat": 55.19, "lon": 36.52 }
      ]
    }
  ]
}
```

### Изменения в коде

- **`data.ts`** — оставить только `COLLECTION_CARD_LIST`. Убрать `LIBRARY_COLLECTIONS`.
- **`shared/lib/library-api`** — новый модуль с двумя функциями:
  - `fetchCollection(id)` → GET `/tracks/{id}/collection.json`
  - `fetchRouteGpx(collectionId, gpxFile)` → GET → парсит через существующий GPX-парсер
- **`useLibraryStore`** — добавить кеш загруженных коллекций
- **`CollectionPage`** — загружать коллекцию через `fetchCollection`, скелетон пока грузится
- **`RouteDetailDrawer`** — загружать GPX через `fetchRouteGpx` при открытии

### Загрузка данных

| Момент | Что загружается |
|--------|----------------|
| Открытие CollectionPage | `collection.json` (метаданные + trackSimplified) |
| Открытие RouteDetailDrawer | полный GPX (для карты и запуска) |

### Процесс добавления маршрута

**С rutrail.org берём:**
- GPX-файл
- Название, регион, дистанция, тип, ближайший населённый пункт, набор высоты
- Ссылку на страницу

**Сами формируем:**
- `id` — slug на латинице (`borovsk-loop`)
- `durationLabel` — «2—3 дня» по дистанции и сложности
- `difficulty` — `easy/medium/hard` по своей оценке
- Описание: 1–2 предложения о характере маршрута
- `highlights`: список ключевых фактов (покрытие, особенности, инфраструктура)

**Генерация `trackSimplified`:**
```bash
npx tsx scripts/simplify-gpx.ts ./public/tracks/moscow-region/borovsk-loop.gpx
```
Скрипт прореживает трек до ~60 точек алгоритмом Рамера-Дугласа-Пёкера и выводит JSON-массив для вставки в `collection.json`.

### Счётчики в `COLLECTION_CARD_LIST`

Поле `count` обновлять вручную при добавлении маршрутов в коллекцию.
