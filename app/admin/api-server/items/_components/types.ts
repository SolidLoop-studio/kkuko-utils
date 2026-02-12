export interface ItemOptions {
    [key: string]: number | undefined
}

export interface Item {
    id: string
    name: string
    description: string
    updatedAt: number
    group: string
    options: ItemOptions
}

export type ItemInput = Omit<Item, 'updatedAt'>
