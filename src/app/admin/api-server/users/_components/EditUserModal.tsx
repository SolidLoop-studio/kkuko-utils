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
import { Checkbox } from '@/src/app/components/ui/checkbox'
import { User, UserInput } from './types'

interface EditUserModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: User | null
    onSave: (user: UserInput) => void
    isSaving: boolean
    readOnly?: boolean
}

export default function EditUserModal({
    open,
    onOpenChange,
    user,
    onSave,
    isSaving,
    readOnly = false,
}: EditUserModalProps) {
    const title = readOnly ? 'View User' : 'Edit User'

    const [isPublic, setIsPublic] = useState(false)

    useEffect(() => {
        if (open && user) {
            setIsPublic(user.isPublic)
        }
    }, [open, user])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({ isPublic })
    }

    if (!user) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">ID</Label>
                        <Input value={user.id} disabled className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Nickname</Label>
                        <Input value={user.nickname} disabled className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">exordial</Label>
                        <Input value={user.exordial} disabled className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Level</Label>
                        <Input value={user.level} disabled className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">EXP</Label>
                        <Input value={user.exp} disabled className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Observed At</Label>
                        <Input value={new Date(user.observedAt).toLocaleString()} disabled className="col-span-3" />
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="isPublic" className="text-right">
                            Public
                        </Label>
                        <div className="flex items-center space-x-2 col-span-3">
                            <Checkbox
                                id="isPublic"
                                checked={isPublic}
                                onCheckedChange={(checked) => setIsPublic(!!checked)}
                                disabled={readOnly}
                            />
                            <Label htmlFor="isPublic">
                                {isPublic ? 'Visible' : 'Hidden'}
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        {!readOnly && (
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
