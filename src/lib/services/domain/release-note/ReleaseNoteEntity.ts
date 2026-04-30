/**
 * 릴리즈 노트 엔티티
 */
export interface ReleaseNoteEntity {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    link: string | null;
}
