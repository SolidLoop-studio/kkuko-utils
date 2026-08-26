import {
    useSaveNotification,
    type NotificationDetailProjection,
    type NotificationImageChange,
    type SaveNotificationCommand,
} from '@/src/modules/notifications';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { useEffect, useRef, useState } from 'react';
import { format } from "date-fns";
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/app/components/ui/card';
import { Button } from "@/src/app/components/ui/button";
import { ChevronLeft, Loader2, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/app/components/ui/tabs";
import MarkdownViewer from '@/src/app/components/MarkdownViewer';
import { Label } from '@/src/app/components/ui/label';
import { Input } from '@/src/app/components/ui/input';
import { Checkbox } from '@/src/app/components/ui/checkbox';
import Image from 'next/image';
import { Textarea } from '@/src/app/components/ui/textarea';
import CompleteModal from '@/src/app/components/CompleteModal';

interface NotificationWriteProps {
    notification?: NotificationDetailProjection;
    onError?: (error: ApplicationError) => void;
}

type LocalImageSelection =
    | { kind: 'keep'; previewUrl: string | null; fileName: null }
    | { kind: 'remove'; previewUrl: null; fileName: null }
    | { kind: 'replace'; file: File; previewUrl: string; fileName: string };

const initialImageSelection = (
    notification?: NotificationDetailProjection,
): LocalImageSelection => ({
    kind: 'keep',
    previewUrl: notification?.imageUrl ?? null,
    fileName: null,
});

const titleValidationError = (): ApplicationError => ({
    kind: 'validation',
    field: 'title',
    message: '공지사항 제목을 입력해주세요.',
});

const bodyValidationError = (): ApplicationError => ({
    kind: 'validation',
    field: 'body',
    message: '공지사항 내용을 입력해주세요.',
});

const endDateValidationError = (): ApplicationError => ({
    kind: 'validation',
    field: 'endsAt',
    message: '올바른 공지사항 종료일이 필요합니다.',
});

const saveInfrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '공지사항 저장에 실패했습니다.',
});

/**
 * 공지사항 작성 컴포넌트
 * 관리자 권한이 있는 사용자만 접근 가능합니다.
 * notification prop이 전달되면 수정 모드로 동작합니다.
 */
export default function NotificationWriteForm({ notification, onError }: NotificationWriteProps) {
    const router = useRouter();
    const { saveNotification, isPending } = useSaveNotification();
    const [title, setTitle] = useState(notification?.title || "");
    const [body, setBody] = useState(notification?.body || "");
    const [endDate, setEndDate] = useState(
        notification ? format(new Date(notification.endsAt), "yyyy-MM-dd") : ""
    );
    const [isImportant, setIsImportant] = useState(notification?.isImportant || false);
    const [isModal, setIsModal] = useState(notification?.isModal || false);
    const [imageSelection, setImageSelection] = useState<LocalImageSelection>(() => (
        initialImageSelection(notification)
    ));
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ownedPreviewUrlRef = useRef<string | null>(null);
    const isSubmittingRef = useRef(false);
    const [completeState, setCompleteState] = useState<{title: string; description: string} | null>(null)

    useEffect(() => {
        if (ownedPreviewUrlRef.current !== null) {
            URL.revokeObjectURL(ownedPreviewUrlRef.current);
            ownedPreviewUrlRef.current = null;
        }
        setTitle(notification?.title ?? "");
        setBody(notification?.body ?? "");
        setEndDate(notification ? format(new Date(notification.endsAt), "yyyy-MM-dd") : "");
        setIsImportant(notification?.isImportant ?? false);
        setIsModal(notification?.isModal ?? false);
        setImageSelection(initialImageSelection(notification));
    }, [notification]);

    useEffect(() => () => {
        if (ownedPreviewUrlRef.current !== null) {
            URL.revokeObjectURL(ownedPreviewUrlRef.current);
            ownedPreviewUrlRef.current = null;
        }
    }, []);

    const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isPending || isSubmittingRef.current) return;
        const file = e.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        if (ownedPreviewUrlRef.current !== null) {
            URL.revokeObjectURL(ownedPreviewUrlRef.current);
        }
        ownedPreviewUrlRef.current = previewUrl;
        setImageSelection({
            kind: 'replace',
            file,
            previewUrl,
            fileName: file.name,
        });
    };

    const handleRemoveImage = () => {
        if (isPending || isSubmittingRef.current) return;
        if (ownedPreviewUrlRef.current !== null) {
            URL.revokeObjectURL(ownedPreviewUrlRef.current);
            ownedPreviewUrlRef.current = null;
        }
        setImageSelection({ kind: 'remove', previewUrl: null, fileName: null });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPending || isSubmittingRef.current) return;

        if (title.trim().length === 0) {
            onError?.(titleValidationError());
            return;
        }
        if (body.trim().length === 0) {
            onError?.(bodyValidationError());
            return;
        }
        if (isModal && endDate === "") {
            onError?.(endDateValidationError());
            return;
        }

        const parsedEndDate = endDate === "" ? new Date(Date.now()) : new Date(endDate);
        if (Number.isNaN(parsedEndDate.getTime())) {
            onError?.(endDateValidationError());
            return;
        }

        const imageChange: NotificationImageChange = imageSelection.kind === 'replace'
            ? { kind: 'replace', file: imageSelection.file }
            : { kind: imageSelection.kind };
        const endsAt = parsedEndDate.toISOString();
        const command: SaveNotificationCommand = notification
            ? {
                mode: 'update',
                id: notification.id,
                expectedImageUrl: notification.imageUrl,
                title,
                body,
                endsAt,
                isImportant,
                isModal,
                imageChange,
            }
            : {
                mode: 'create',
                title,
                body,
                endsAt,
                isImportant,
                isModal,
                imageChange: imageChange.kind === 'remove' ? { kind: 'keep' } : imageChange,
            };

        isSubmittingRef.current = true;
        try {
            const result = await saveNotification(command);
            if (!result.ok) {
                onError?.(result.error);
                return;
            }
            setCompleteState({
                title: notification ? '공지사항이 수정되었습니다.' : '공지사항이 등록되었습니다.',
                description: ''
            });
        } catch {
            onError?.(saveInfrastructureError());
        } finally {
            isSubmittingRef.current = false;
        }
    };

    const handleCloseCompleteModal = () => {
        router.push(notification ? `/notification/${notification.id}` : "/notification");
        router.refresh();
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {completeState && (
                <CompleteModal
                    open={true}
                    onClose={handleCloseCompleteModal}
                    title={completeState.title}
                    description={completeState.description}
                />
            )}
            <div className="flex items-center gap-2 mb-6">
                <Link href={notification ? `/notification/${notification.id}` : "/notification"}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">{notification ? "공지사항 수정" : "공지사항 작성"}</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{notification ? "공지사항 수정" : "새 공지사항"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">제목</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="공지사항 제목을 입력하세요"
                                required
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="endDate">게시 종료일</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required={isModal}
                                />
                            </div>
                            <div className="flex items-end gap-6 pb-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="isImportant"
                                        checked={isImportant}
                                        onCheckedChange={(checked) => setIsImportant(checked as boolean)}
                                    />
                                    <Label htmlFor="isImportant">중요 공지 (상단 고정)</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="isModal"
                                        checked={isModal}
                                        onCheckedChange={(checked) => setIsModal(checked as boolean)}
                                    />
                                    <Label htmlFor="isModal">팝업 공지</Label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>이미지 첨부</Label>
                            <div className="flex items-center gap-4">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImageSelection}
                                    disabled={isPending}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (!isPending && !isSubmittingRef.current) {
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                    disabled={isPending}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    이미지 선택
                                </Button>
                                {imageSelection.fileName && (
                                    <span className="text-sm text-muted-foreground">
                                        {imageSelection.fileName}
                                    </span>
                                )}
                                {imageSelection.previewUrl && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveImage}
                                        disabled={isPending}
                                        aria-label="이미지 제거"
                                        className="text-destructive hover:text-destructive/90"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            {imageSelection.previewUrl && (
                                <div className="mt-2 relative w-full h-48 bg-muted rounded-md overflow-hidden">
                                    <Image
                                        src={imageSelection.previewUrl}
                                        alt="Preview"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>내용 (Markdown 지원)</Label>
                            <Tabs defaultValue="write" className="w-full">
                                <TabsList>
                                    <TabsTrigger value="write">작성하기</TabsTrigger>
                                    <TabsTrigger value="preview">미리보기</TabsTrigger>
                                </TabsList>
                                <TabsContent value="write" className="mt-2">
                                    <Textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder="공지 내용을 입력하세요 (Markdown 문법 지원)"
                                        className="min-h-[300px] font-mono"
                                        required
                                    />
                                </TabsContent>
                                <TabsContent value="preview" className="mt-2">
                                    <div className="min-h-[300px] border rounded-md p-4 prose dark:prose-invert max-w-none overflow-y-auto">
                                        {body ? (
                                            <MarkdownViewer content={body} />
                                        ) : (
                                            <p className="text-muted-foreground text-sm">내용을 입력하면 미리보기가 표시됩니다.</p>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Link href={notification ? `/notification/${notification.id}` : "/notification"}>
                                <Button type="button" variant="outline">취소</Button>
                            </Link>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {notification ? "수정하기" : "등록하기"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
