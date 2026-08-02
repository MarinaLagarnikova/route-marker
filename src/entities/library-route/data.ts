import col2 from '@/assets/collections/col-2.jpg'
import col3 from '@/assets/collections/col-3.jpg'
import col4 from '@/assets/collections/col-4.jpg'
import col5 from '@/assets/collections/col-5.jpg'
import col6 from '@/assets/collections/col-6.jpg'
import col7 from '@/assets/collections/col-7.jpg'
import col8 from '@/assets/collections/col-8.jpg'

export interface CollectionCardMeta {
  id: string
  name: string
  count: number
  imageUrl?: string
}

export const COLLECTION_CARD_LIST: CollectionCardMeta[] = [
  { id: 'favorites', name: 'Избранное', count: 0 },
  { id: 'moscow-region',   name: 'Москва и область',           count: 27, imageUrl: col2 },
  { id: 'central-russia',  name: 'Центральная Россия',          count: 25, imageUrl: col3 },
  { id: 'caucasus-crimea', name: 'Кавказ и Крым',               count: 17, imageUrl: col4 },
  { id: 'murmansk-region', name: 'Мурманская область',          count: 13, imageUrl: col5 },
  { id: 'siberia',         name: 'Сибирь',                      count: 11, imageUrl: col6 },
  { id: 'spb-karelia',     name: 'Санкт-Петербург и Карелия',   count: 9,  imageUrl: col7 },
  { id: 'ural',            name: 'Урал',                        count: 8,  imageUrl: col8 },
]
