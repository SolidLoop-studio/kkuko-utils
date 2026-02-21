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
import { Edit2 } from 'lucide-react'
import { useMemo } from 'react'
import { User } from './types'
import Spinner from '@/src/app/components/Spinner'

interface UsersTableProps {
    items: User[]
    isLoading: boolean
    onEdit: (item: User) => void
    onRowClick: (item: User) => void
}

export default function UsersTable({ items, isLoading, onEdit, onRowClick }: UsersTableProps) {
    const columns = useMemo<ColumnDef<User>[]>(() => {
        // If items are empty, we can return empty columns or pre-defined columns.
        // But dynamic assumes we have at least one item to know the shape.
        // Let's define manual columns if empty is not guaranteed or to enforce order.
        // For simplicity, sticking to dynamic like ItemsTable. 
        if (!items || items.length === 0) return []

        const firstItem = items[0]
        const keys = Object.keys(firstItem) as (keyof User)[]

        const generatedColumns: ColumnDef<User>[] = keys.map((key) => {
            return {
                accessorKey: key,
                header: key.charAt(0).toUpperCase() + key.slice(1),
                cell: ({ getValue }) => {
                    const value = getValue()
                    
                    if (key === 'observedAt') {
                        try {
                            return new Date(String(value)).toLocaleString()
                        } catch {
                            return String(value)
                        }
                    }
                    if (typeof value === 'boolean') {
                        return <span className={value ? 'text-green-600' : 'text-red-500'}>{value ? 'TRUE' : 'FALSE'}</span>
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
                    </div>
                )
            },
        })

        return generatedColumns
    }, [items, onEdit])

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
        return <div className="text-center py-10 text-muted-foreground">No users found.</div>
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
