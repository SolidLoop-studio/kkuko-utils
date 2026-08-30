'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Search } from 'lucide-react'

import { Button } from '@/src/app/components/ui/button'
import { Input } from '@/src/app/components/ui/input'
import ConfirmModal from '@/src/app/components/ConfirmModal'
import ItemsTable from './_components/ItemsTable'
import EditItemModal from './_components/EditItemModal'
import { Item, ItemInput } from './_components/types'
import FailModal from '@/src/app/components/FailModal'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select"

import * as API from '@/src/modules/admin-api-server'
import Link from 'next/link'

export default function ItemsManageHome() {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchType, setSearchType] = useState('name')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [deletingItem, setDeletingItem] = useState<Item | null>(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    
    // Error state
    const [error, setError] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm)
            setPage(1) // Reset page on search
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const fetchItemsFn = async () => {
        if (debouncedSearch) {
            if (searchType === 'group') {
                return API.searchItemsByGroup(debouncedSearch, page)
            }
            return API.searchItems(debouncedSearch, page)
        }
        return API.fetchItems(page)
    }

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['items', page, debouncedSearch, searchType],
        queryFn: fetchItemsFn,
    })

    const createMutation = useMutation({
        mutationFn: (newItem: ItemInput) => API.createItem(newItem),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] })
            setIsEditModalOpen(false)
        },
        onError: (err) => handleError(err),
    })

    const updateMutation = useMutation({
        mutationFn: (updatedItem: ItemInput) => {
            const { id, ...rest } = updatedItem
            return API.updateItem(id, rest)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] })
            setIsEditModalOpen(false)
        },
        onError: (err) => handleError(err),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => API.deleteItem(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] })
            setIsConfirmOpen(false)
        },
        onError: (err) => handleError(err),
    })

    const handleError = (_err: unknown) => {
        setError('아이템 작업을 완료하지 못했습니다.')
    }

    const handleEdit = (item: Item) => {
        setEditingItem(item)
        setIsReadOnly(false)
        setIsEditModalOpen(true)
    }

    const handleCreate = () => {
        setEditingItem(null)
        setIsReadOnly(false)
        setIsEditModalOpen(true)
    }

    const handleRowClick = (item: Item) => {
        setEditingItem(item)
        setIsReadOnly(true)
        setIsEditModalOpen(true)
    }

    const handleDeleteClick = (item: Item) => {
        setDeletingItem(item)
        setIsConfirmOpen(true)
    }

    const handleSave = (itemInput: ItemInput) => {
        if (editingItem) {
            updateMutation.mutate(itemInput)
        } else {
            createMutation.mutate(itemInput)
        }
    }

    const handleConfirmDelete = () => {
        if (deletingItem) {
            deleteMutation.mutate(deletingItem.id)
        }
    }

    // Effect to show query error
    useEffect(() => {
        if (isError && queryError) {
            setError('아이템 정보를 불러오는데 실패했습니다.')
        }
    }, [isError, queryError])
    
    // When searchType changes, refetch if there is a search term
    useEffect(() => {
        if (debouncedSearch) {
             queryClient.invalidateQueries({ queryKey: ['items'] })
        }
    }, [searchType, queryClient, debouncedSearch])

    return (
        <div className="container mx-auto py-10 space-y-6 min-h-[calc(100vh-200px)]">
            <Link href={'/admin/api-server'} className="mb-4 flex outline-none">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    api-server admin 홈으로 이동
                </Button>
            </Link>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Item Management</h1>
                <Button onClick={handleCreate} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Item
                </Button>
            </div>

            <div className="flex items-center space-x-2 w-full max-w-lg">
                <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Search by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                </Select>
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search by ${searchType}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <ItemsTable
                items={data?.items || []}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onRowClick={handleRowClick}
            />

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm">
                        Page {data.currentPage} of {data.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            <EditItemModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                item={editingItem}
                onSave={handleSave}
                isSaving={createMutation.isPending || updateMutation.isPending}
                readOnly={isReadOnly}
            />

            <ConfirmModal
                open={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Item"
                description={`Are you sure you want to delete item "${deletingItem?.name}"? This action cannot be undone.`}
            />

            {error && (
                <FailModal
                    open={Boolean(error)}
                    title="작업 실패"
                    description={error}
                    onClose={() => setError(null)}
                />
            )}
        </div>
    )
}
