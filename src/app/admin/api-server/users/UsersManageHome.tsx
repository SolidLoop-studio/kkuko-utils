'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/src/app/components/ui/button'
import { Input } from '@/src/app/components/ui/input'
import UsersTable from './_components/UsersTable'
import EditUserModal from './_components/EditUserModal'
import { User, UserInput } from './_components/types'
import FailModal from '@/src/app/components/FailModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select"

import * as API from '@/src/modules/admin-api-server'

export default function UsersManageHome() {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    // Although currently only nickname search is implemented, keeping structure flexible
    const [searchType, setSearchType] = useState('nickname') 

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
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

    const fetchUsersFn = async () => {
        if (debouncedSearch) {
            if (searchType === 'id') {
                return API.fetchUserById(debouncedSearch)
            }
            return API.searchUsersByNickname(debouncedSearch)
        }
        return API.fetchUsers(page)
    }

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['users', page, debouncedSearch, searchType],
        queryFn: fetchUsersFn,
    })

    const updateMutation = useMutation({
        mutationFn: async (vars: { id: string, input: UserInput }) => {
            // We call both endpoints.
            // If one fails, the mutation fails.
            // Ideally should check what changed, but calling both is safe if idempotent-like (setting value).
            await API.updateUserPublicStatus(vars.id, vars.input.isPublic)
            if (vars.input.isLastOnlineHidden !== undefined) {
                 await API.updateUserLastOnlineHiddenStatus(vars.id, vars.input.isLastOnlineHidden)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setIsEditModalOpen(false)
        },
        onError: (err) => handleError(err),
    })

    const handleError = (_err: unknown) => {
        setError('사용자 작업을 완료하지 못했습니다.')
    }

    const handleEdit = (user: User) => {
        setEditingUser(user)
        setIsReadOnly(false)
        setIsEditModalOpen(true)
    }

    const handleRowClick = (user: User) => {
        setEditingUser(user)
        setIsReadOnly(true)
        setIsEditModalOpen(true)
    }

    const handleSave = (userInput: UserInput) => {
        if (editingUser) {
            updateMutation.mutate({ id: editingUser.id, input: userInput })
        }
    }

    // Effect to show query error
    useEffect(() => {
        if (isError && queryError) {
            setError('사용자 정보를 불러오는데 실패했습니다.')
        }
    }, [isError, queryError])
    
    return (
        <div className="container mx-auto py-10 space-y-6 min-h-[calc(100vh-200px)]">
            <Link href={'/admin/api-server'} className="mb-4 flex outline-none">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    api-server admin 홈으로 이동
                </Button>
            </Link>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">User Management</h1>
            </div>

            <div className="flex items-center space-x-2 w-full max-w-lg">
                <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Search by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="nickname">Nickname</SelectItem>
                        <SelectItem value="id">ID</SelectItem>
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

            <UsersTable
                items={data?.items || []}
                isLoading={isLoading}
                onEdit={handleEdit}
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

            <EditUserModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                user={editingUser}
                onSave={handleSave}
                isSaving={updateMutation.isPending}
                readOnly={isReadOnly}
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
