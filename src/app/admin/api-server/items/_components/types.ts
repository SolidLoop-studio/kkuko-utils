import type { Item } from '@/src/modules/admin-api-server'

export type { Item }

export type ItemInput = Omit<Item, 'updatedAt'>
