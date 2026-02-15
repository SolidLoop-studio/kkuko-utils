'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/src/app/components/ui/dialog'
import { Button } from '@/src/app/components/ui/button'
import { Input } from '@/src/app/components/ui/input'
import { Label } from '@/src/app/components/ui/label'
import { Textarea } from '@/src/app/components/ui/textarea'
import { Item, ItemInput } from './types'

interface EditItemModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: Item | null
    onSave: (item: ItemInput) => void
    isSaving: boolean
    readOnly?: boolean
}

/**
 * EditItemModal component
 * Modal for creating or editing an item.
 * Validates JSON for the 'options' field.
 */
export default function EditItemModal({
    open,
    onOpenChange,
    item,
    onSave,
    isSaving,
    readOnly = false,
}: EditItemModalProps) {
    const isEditMode = !!item
    const title = readOnly ? 'View Item' : isEditMode ? 'Edit Item' : 'Create Item'

    const [formData, setFormData] = useState<ItemInput>({
        id: '',
        name: '',
        description: '',
        group: '',
        options: {},
    })

    const [optionsJson, setOptionsJson] = useState('{}')
    const [jsonError, setJsonError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            if (item) {
                setFormData({
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    group: item.group,
                    options: item.options,
                })
                setOptionsJson(JSON.stringify(item.options, null, 2))
            } else {
                // Reset for create mode
                setFormData({
                    id: '',
                    name: '',
                    description: '',
                    group: '',
                    options: {},
                })
                setOptionsJson('{}')
            }
            setJsonError(null)
        }
    }, [open, item])

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setOptionsJson(value)
        try {
            JSON.parse(value)
            setJsonError(null)
        } catch (err) {
            setJsonError((err as Error).message)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (jsonError) return

        try {
            const parsedOptions = JSON.parse(optionsJson)
            onSave({
                ...formData,
                options: parsedOptions,
            })
        } catch (_err) {
            setJsonError('Invalid JSON')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="id" className="text-right">
                            ID
                        </Label>
                        <Input
                            id="id"
                            name="id"
                            value={formData.id}
                            onChange={handleInputChange}
                            className="col-span-3"
                            disabled={isEditMode || readOnly}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="col-span-3"
                            disabled={readOnly}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="group" className="text-right">
                            Group
                        </Label>
                        <Input
                            id="group"
                            name="group"
                            value={formData.group}
                            onChange={handleInputChange}
                            className="col-span-3"
                            disabled={readOnly}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="description" className="text-right pt-2">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            className="col-span-3"
                            rows={3}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="options" className="text-right pt-2">
                            Options (JSON)
                        </Label>
                        <div className="col-span-3">
                            <Textarea
                                id="options"
                                name="options"
                                value={optionsJson}
                                onChange={handleJsonChange}
                                className={`font-mono text-xs ${
                                    jsonError ? 'border-red-500' : ''
                                }`}
                                rows={10}
                                disabled={readOnly}
                            />
                            {jsonError && (
                                <p className="text-xs text-red-500 mt-1">
                                    {jsonError}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        {!readOnly && (
                            <Button type="submit" disabled={isSaving || !!jsonError}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
