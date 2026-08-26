import type { NotificationDetailProjection } from '@/src/modules/notifications';
import { useEffect, useRef, useState } from 'react';
import { format } from "date-fns";
import { SCM } from '@/src/app/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { PostgrestError } from "@supabase/supabase-js";
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
    onError?: (error: PostgrestError) => void;
}

/**
 * 공지사항 작성 컴포넌트
 * 관리자 권한이 있는 사용자만 접근 가능합니다.
 * notification prop이 전달되면 수정 모드로 동작합니다.
 */
export default function NotificationWriteForm({ notification, onError }: NotificationWriteProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState(notification?.title || "");
    const [body, setBody] = useState(notification?.body || "");
    const [endDate, setEndDate] = useState(
        notification ? format(new Date(notification.endsAt), "yyyy-MM-dd") : ""
    );
    const [isImportant, setIsImportant] = useState(notification?.isImportant || false);
    const [isModal, setIsModal] = useState(notification?.isModal || false);
    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(notification?.imageUrl || null);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [completeState, setCompleteState] = useState<{title: string; description: string} | null>(null)

    useEffect(() => {
        if (notification) {
            setTitle(notification.title);
            setBody(notification.body);
            setEndDate(format(new Date(notification.endsAt), "yyyy-MM-dd"));
            setIsImportant(notification.isImportant || false);
            setIsModal(notification.isModal || false);
            setImageUrl(notification.imageUrl);
        }
    }, [notification]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const path = `notifications/${Date.now()}_${file.name}`;
            const { error: uploadError } = await SCM.uploadImage(file, path);

            if (uploadError) throw uploadError;

            const { data } = SCM.getPublicUrl(path);
            if (data?.publicUrl) {
                setImageUrl(data.publicUrl);
                setFileName(file.name);
            }
        } catch (error) {
            console.error("Image upload failed:", error);
            onError?.(error as PostgrestError);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveImage = async () => {
        setImageUrl(null);
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !body.trim() || (isModal && !endDate)) {
            alert("제목, 내용, 종료일을 모두 입력해주세요.");
            return;
        }

        try {
            setIsLoading(true);
            let result;

            if (notification) {
                // 수정
                result = await SCM.update().notification(notification.id, {
                    title,
                    body,
                    img: imageUrl,
                    end_at: endDate === "" ? new Date(Date.now()).toISOString() : new Date(endDate).toISOString(),
                    is_important: isImportant,
                    is_modal: isModal,
                });
            } else {
                // 추가
                result = await SCM.add().notification({
                    title,
                    body,
                    img: imageUrl,
                    end_at: endDate === "" ? new Date(Date.now()).toISOString() : new Date(endDate).toISOString(),
                    is_important: isImportant,
                    is_modal: isModal,
                });
            }

            if (result.error) throw result.error;
            // show success modal
            setCompleteState({
                title: notification ? '공지사항이 수정되었습니다.' : '공지사항이 등록되었습니다.',
                description: ''
            });
        } catch (error) {
            console.error("Notification submit failed:", error);
            onError?.(error as PostgrestError);
        } finally {
            setIsLoading(false);
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
                                    onChange={handleImageUpload}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4 mr-2" />
                                    )}
                                    이미지 선택
                                </Button>
                                {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
                                {imageUrl && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRemoveImage}
                                        className="text-destructive hover:text-destructive/90"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            {imageUrl && (
                                <div className="mt-2 relative w-full h-48 bg-muted rounded-md overflow-hidden">
                                    <Image
                                        src={imageUrl}
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
                            <Button type="submit" disabled={isLoading || uploading}>
                                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {notification ? "수정하기" : "등록하기"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
