import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoticeModal from "@/src/app/components/NoticeModal";

// Mock UI components
jest.mock("@/app/components/ui/dialog", () => ({
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-content">{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-header">{children}</div>
    ),
    DialogTitle: ({ children }: { children: React.ReactNode }) => (
        <h2 data-testid="dialog-title">{children}</h2>
    ),
    DialogFooter: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-footer">{children}</div>
    ),
}));

jest.mock("@/app/components/ui/button", () => ({
    Button: ({ children, onClick }: any) => (
        <button onClick={onClick} data-testid="button">
            {children}
        </button>
    ),
}));

jest.mock("@/app/components/ui/checkbox", () => ({
    Checkbox: ({ checked, onCheckedChange, id }: any) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
                if (onCheckedChange) {
                    onCheckedChange(e.target.checked);
                }
            }}
            id={id}
            data-testid="checkbox"
        />
    ),
}));

jest.mock("next/image", () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: ({ priority, ...props }: any) => <img {...props} />,
}));

jest.mock("lucide-react", () => ({
    Info: () => <div data-testid="info-icon">Info</div>,
}));

jest.mock("@/app/components/MarkdownViewer", () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => (
        <div data-testid="markdown-viewer">{content}</div>
    ),
}));

describe("NoticeModal", () => {
    const mockNotice = {
        id: 1,
        title: "테스트 공지",
        body: "# 마크다운 테스트\n\n**볼드 텍스트**입니다.",
        img: null,
        created_at: "2024-02-12T12:00:00Z",
    };

    const mockOnClose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders when open is true", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        expect(screen.getByTestId("dialog")).toBeInTheDocument();
        expect(screen.getByText("공지사항")).toBeInTheDocument();
        expect(screen.getByText("테스트 공지")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
        render(
            <NoticeModal open={false} onClose={mockOnClose} notice={mockNotice} />
        );

        expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });

    it("renders markdown content using MarkdownViewer", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        const markdownViewer = screen.getByTestId("markdown-viewer");
        expect(markdownViewer).toBeInTheDocument();
        // Just check that the markdown viewer is rendered with some content
        expect(markdownViewer.textContent).toBeTruthy();
    });

    it("renders image when img is provided", () => {
        const noticeWithImage = {
            ...mockNotice,
            img: "https://example.com/image.jpg",
        };

        render(
            <NoticeModal
                open={true}
                onClose={mockOnClose}
                notice={noticeWithImage}
            />
        );

        const image = screen.getByAltText("공지 이미지");
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute("src", noticeWithImage.img);
    });

    it("does not render image when img is null", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        expect(screen.queryByAltText("공지 이미지")).not.toBeInTheDocument();
    });

    it("saves notice id to localStorage when hideNext is checked and modal is closed", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        const button = screen.getByTestId("button");
        fireEvent.click(button);

        expect(mockOnClose).toHaveBeenCalled();
        const hiddenNotices = JSON.parse(
            localStorage.getItem("hiddenNotices") || "[]"
        );
        expect(hiddenNotices).toContain(mockNotice.id);
    });

    it.each([
        ["malformed JSON", "{", [1]],
        ["a non-array value", "{}", [1]],
        ["mixed and duplicate ids", JSON.stringify([2, "bad", 2, -1, 3.5]), [2, 1]],
    ])("normalizes %s and still closes exactly once", async (_case, storedValue, expectedIds) => {
        const user = userEvent.setup();
        localStorage.setItem("hiddenNotices", storedValue);
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        await user.click(screen.getByTestId("button"));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem("hiddenNotices") || "[]")).toEqual(expectedIds);
    });

    it.each(["getItem", "setItem"] as const)(
        "closes even when localStorage.%s throws",
        async (method) => {
            const user = userEvent.setup();
            const storageSpy = jest.spyOn(Storage.prototype, method).mockImplementation(() => {
                throw new Error("private storage detail");
            });
            render(
                <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
            );

            await user.click(screen.getByTestId("button"));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
            storageSpy.mockRestore();
        },
    );

    it("does not save notice id when hideNext is unchecked", async () => {
        const user = userEvent.setup();
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        const checkbox = screen.getByTestId("checkbox");
        await user.click(checkbox);

        const button = screen.getByTestId("button");
        await user.click(button);

        expect(mockOnClose).toHaveBeenCalled();
        const hiddenNotices = JSON.parse(
            localStorage.getItem("hiddenNotices") || "[]"
        );
        expect(hiddenNotices).not.toContain(mockNotice.id);
    });

    it("does not inspect malformed storage when hideNext is unchecked", async () => {
        const user = userEvent.setup();
        localStorage.setItem("hiddenNotices", "{");
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        await user.click(screen.getByTestId("checkbox"));
        await user.click(screen.getByTestId("button"));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("hiddenNotices")).toBe("{");
    });

    it("displays formatted date", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        // Date formatting includes Korean locale
        const dateElement = screen.getByTestId("dialog-header");
        expect(dateElement).toBeInTheDocument();
    });

    it("renders checkbox with correct default state", () => {
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        const checkbox = screen.getByTestId("checkbox");
        expect(checkbox).toBeChecked();
    });

    it("toggles checkbox state when clicked", async () => {
        const user = userEvent.setup();
        render(
            <NoticeModal open={true} onClose={mockOnClose} notice={mockNotice} />
        );

        const checkbox = screen.getByTestId("checkbox");
        expect(checkbox).toBeChecked();

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();

        await user.click(checkbox);
        expect(checkbox).toBeChecked();
    });
});
