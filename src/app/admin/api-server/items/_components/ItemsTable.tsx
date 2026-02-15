'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/app/components/ui/table'
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/src/app/components/ui/button'
import { Edit2, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Item } from './types'
import Spinner from '@/src/app/components/Spinner'

interface ItemsTableProps {
    items: Item[]
    isLoading: boolean
    onEdit: (item: Item) => void
    onDelete: (item: Item) => void
    onRowClick: (item: Item) => void
}

/**
 * ItemsTable component
 * Renders a table of items using @tanstack/react-table
 * Columns are dynamically generated based on the first item's schema
 */
export default function ItemsTable({ items, isLoading, onEdit, onDelete, onRowClick }: ItemsTableProps) {
    const columns = useMemo<ColumnDef<Item>[]>(() => {
        if (!items || items.length === 0) return []

        // Generate columns from the first item
        const firstItem = items[0]
        const keys = Object.keys(firstItem) as (keyof Item)[]

        const generatedColumns: ColumnDef<Item>[] = keys.map((key) => {
            return {
                accessorKey: key,
                header: key.charAt(0).toUpperCase() + key.slice(1),
                cell: ({ getValue }) => {
                    const value = getValue()
                    
                    if (key === 'updatedAt') {
                        const dateNum = typeof value === 'string' ? parseInt(value, 10) : Number(value);
                        if (!isNaN(dateNum)) {
                            return new Date(dateNum).toLocaleString()
                        }
                    }
                    if (key === 'options' && typeof value === 'object') {
                        return <div className="max-w-[200px] truncate text-xs font-mono" title={JSON.stringify(value, null, 2)}>{JSON.stringify(value)}</div>
                    }
                    if (key === 'updatedAt') {
                        // Already handled above, but keeping structure clean if reordered.
                        // Actually, I should remove the old block if I inserted a new one before it. 
                        // But wait, I am in replace_string_in_file tool. I inserted the check BEFORE 'options' check in previous call?
                        // No, let me look at the previous call.
                        // I replaced:
                        // if (key === 'options' && typeof value === 'object') {
                        // WITH:
                        // if (key === 'updatedAt') { ... } 
                        // if (key === 'options' && typeof value === 'object') {
                        
                        // So I need to REMOVE the old updatedAt check which was AFTER 'options'.
                        // The old code had:
                        // if (key === 'options' ...
                        //     return ...
                        // }
                        // if (key === 'updatedAt' && typeof value === 'number') {
                        //     return ...
                        // }
                        
                        // My previous tool call inserted the new updatedAt check BEFORE options.
                        // So now I have:
                        // ...
                        // if (key === 'updatedAt') ...
                        // if (key === 'options' ...
                        // if (key === 'updatedAt' && typeof value === 'number') ...
                        // 
                        // I need to remove the second (original) updatedAt check.
                    }
                    if (typeof value === 'string' && value.length > 50) {
                        return <div className="max-w-[200px] truncate" title={value}>{value}</div>
                    }
                    return String(value)
                },
            }
        })

        // Add actions column
        generatedColumns.push({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(item)}
                            title="Edit"
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(item)}
                            title="Delete"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        })

        return generatedColumns
    }, [items, onEdit, onDelete])

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    if (isLoading) {
         return (
             <div className="w-full h-48 flex items-center justify-center">
                <Spinner />
            </div>
        )
    }

    if (!items || items.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No items found.</div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && 'selected'}
                                onClick={() => onRowClick(row.original)}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="border-x first:border-l-0 last:border-r-0">
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                            >
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
