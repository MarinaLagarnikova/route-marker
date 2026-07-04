export const APP_NAME = 'Вешка'
export const YANDEX_MAPS_API_KEY = import.meta.env['VITE_YANDEX_MAPS_API_KEY'] as string
export const DGIS_API_KEY = (import.meta.env['VITE_2GIS_API_KEY'] as string) ?? ''
export const STORAGE_KEY_PREFIX = 'veshka_'
export const AUTO_CHECKPOINT_INTERVAL_KM = 1
export const MIN_CHECKPOINTS_BEFORE_AUTO = 3
