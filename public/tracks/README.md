# Библиотека маршрутов

Статические данные подборок. Раздаются как есть из `public/`, поэтому любой путь
здесь — это готовый URL: `public/tracks/ural/track.gpx` → `/tracks/ural/track.gpx`.

## Структура

```
public/tracks/
  rutrail-logo.svg              логотип источника RuTrail
  veshka-logo.svg               логотип источника «Вешка»
  <регион>/
    collection.json             метаданные всех маршрутов региона
    <маршрут>.gpx               импорт RuTrail — плоско
    <id-маршрута>/              маршрут от Вешки — папка на маршрут
      track.gpx
      photo-1.jpg
      photo-2.jpg
```

### Почему две конвенции

Граница смысловая: **плоский файл = внешний импорт, папка = маршрут, который мы
ведём сами**. У маршрутов от Вешки есть фото и они пополняются, у импорта — нет.

Существующие 110 файлов RuTrail лежат плоско и переносить их нельзя:
`pinRoute` в `entities/library-route/store.ts` сохраняет объект маршрута вместе с
полем `gpx` в localStorage. Если сменить путь, у пользователя с уже закреплённым
маршрутом останется ссылка на несуществующий файл, а `handleOpenPinnedRoute`
в `pages/start` ошибку не обрабатывает — маршрут просто не откроется.

Поле `gpx` в `collection.json` — это путь относительно папки региона, поэтому
подпапка работает без правок кода: `"gpx": "zvenigorodskie-holmy/track.gpx"`.

## Как добавить свой маршрут

1. Записать трек в Maps.me / Organic Maps, выгрузить KMZ.
2. Выбрать `id` — латиницей через дефис, он же имя папки: `zvenigorodskie-holmy`.
3. Сконвертировать трек:

   ```sh
   mkdir -p public/tracks/<регион>/<id>
   npx tsx scripts/kmz-to-gpx.ts "Треки/<файл>.kmz" "<Название>" \
     > public/tracks/<регион>/<id>/track.gpx
   ```

4. Положить фото в ту же папку: `photo-1.jpg`, `photo-2.jpg`, …
   По длинной стороне до 1600 px, JPEG качества ~80, цель — 200–400 КБ на файл.
   Файлы из `public/` не проходят через сборщик и отдаются как есть, поэтому
   размер важен: он целиком ложится на мобильный трафик.
5. Получить упрощённый трек для карточки и мини-карты региона:

   ```sh
   npx tsx scripts/simplify-gpx.ts public/tracks/<регион>/<id>/track.gpx
   ```

6. Добавить запись в `collection.json` региона и увеличить `totalRoutes`:

   ```jsonc
   {
     "id": "zvenigorodskie-holmy",
     "name": "Звенигородские холмы",
     "gpx": "zvenigorodskie-holmy/track.gpx",     // путь относительно папки региона
     "photos": ["/tracks/moscow-region/zvenigorodskie-holmy/photo-1.jpg"],  // от корня сайта
     "region": { "id": "moscow-region", "name": "Москва и область" },
     "distanceKm": 10.8,
     "durationLabel": "3—4 часа",       // длинное тире, не дефис
     "difficulty": "easy",
     "elevationGainM": 85,
     "type": "linear",
     "nearestSettlement": "Звенигород",
     "description": "…",
     "highlights": ["…"],
     "source": {
       "name": "Вешка",
       "tagline": "Маршрут от Вешки",
       "url": "https://veshka.vercel.app",
       "logoUrl": "/tracks/veshka-logo.svg"
     },
     "trackSimplified": []              // вывод simplify-gpx.ts
   }
   ```

Обрати внимание на разницу: `gpx` — путь **относительно папки региона**, а `photos` —
пути **от корня сайта**. Так сложилось потому, что `gpx` склеивается в
`shared/lib/library-api`, а фото подставляются в `<img src>` напрямую.

## Набор высоты

GPS пишет высоту с шумом: у трека по Звенигороду перепад 50 м, а сырой набор —
337 м. Для `elevationGainM` считай набор со сглаживанием (порог ~15 м), иначе
цифра будет несопоставима с остальной библиотекой, где у маршрута 10–15 км
обычно 70–150 м.
