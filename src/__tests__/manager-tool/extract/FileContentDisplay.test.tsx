import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileContentDisplay from "@/src/app/manager-tool/extract/components/FileContentDisplay";

// Mock UI components
jest.mock("@/app/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="card-title">{children}</h2>
  ),
}));

jest.mock("@/app/components/ui/input", () => ({
  Input: (props: any) => <input {...props} data-testid="input" />,
}));

jest.mock("@/app/components/ui/label", () => ({
  Label: ({ children, ...props }: any) => (
    <label {...props} data-testid="label">
      {children}
    </label>
  ),
}));

jest.mock("@/app/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div {...props} data-testid="scroll-area">
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => (
    <span {...props} data-testid="badge">
      {children}
    </span>
  ),
}));

jest.mock("@/app/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} data-testid="button">
      {children}
    </button>
  ),
}));

describe("FileContentDisplay", () => {
  const mockSetFileContent = jest.fn();
  const mockSetFile = jest.fn();
  const mockOnFileUpload = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    setFileContent: mockSetFileContent,
    setFile: mockSetFile,
    file: null,
    fileContent: null,
    onFileUpload: mockOnFileUpload,
    onError: mockOnError,
    resultData: [],
    resultTitle: "처리 결과",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("렌더링이 정상적으로 되는지 확인", () => {
    render(<FileContentDisplay {...defaultProps} />);

    expect(screen.getByText("파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("업로드된 파일 내용")).toBeInTheDocument();
    expect(screen.getByText("처리 결과")).toBeInTheDocument();
  });

  it("파일이 없을 때 플레이스홀더가 표시되는지 확인", () => {
    render(<FileContentDisplay {...defaultProps} />);

    expect(
      screen.getByText("아직 파일이 업로드되지 않았습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("아직 처리 결과가 없습니다.")).toBeInTheDocument();
  });

  it("파일 업로드 처리가 정상적으로 되는지 확인", async () => {
    const user = userEvent.setup();
    const mockFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });

    render(<FileContentDisplay {...defaultProps} />);

    const fileInput = screen.getByLabelText("텍스트 파일 선택");

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(mockSetFile).toHaveBeenCalledWith(mockFile);
    });
  });

  it("파일이 업로드되면 파일 정보가 표시되는지 확인", () => {
    const mockFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });

    render(<FileContentDisplay {...defaultProps} file={mockFile} />);

    expect(screen.getByText("test.txt")).toBeInTheDocument();
    expect(screen.getByText(/KB/)).toBeInTheDocument();
  });

  it("파일 내용이 있을 때 정상적으로 표시되는지 확인", () => {
    const testContent = "line1\nline2\nline3";

    render(<FileContentDisplay {...defaultProps} fileContent={testContent} />);

    expect(screen.getByText((c) => c.includes("line1"))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("line2"))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("line3"))).toBeInTheDocument();
  });

  it("결과 데이터가 있을 때 정상적으로 표시되는지 확인", () => {
    const resultData = ["result1", "result2", "result3"];

    render(<FileContentDisplay {...defaultProps} resultData={resultData} />);

    expect(screen.getByText((c) => c.includes("result1"))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("result2"))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes("result3"))).toBeInTheDocument();
    expect(screen.getByText("3개")).toBeInTheDocument();
  });

  it("초기화 버튼이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    const mockFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });

    render(<FileContentDisplay {...defaultProps} file={mockFile} />);

    const resetButton = screen.getByText("초기화");
    await user.click(resetButton);

    expect(mockSetFile).toHaveBeenCalledWith(null);
    expect(mockSetFileContent).toHaveBeenCalledWith(null);
  });

  it("검색 기능이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    const testContent = "apple\nbanana\napricot\ncherry";

    render(<FileContentDisplay {...defaultProps} fileContent={testContent} />);

    const searchInput = screen.getByPlaceholderText("내용 검색...");
    await user.type(searchInput, "ap");

    // 검색 결과에 apple과 apricot만 표시되어야 함
    expect(screen.getByText("2줄")).toBeInTheDocument();
  });

  it("대용량 파일에서 가상화 모드가 활성화되는지 확인", () => {
    // 5000줄 이상의 대용량 텍스트 생성
    const largeContent = Array.from(
      { length: 6000 },
      (_, i) => `line${i}`,
    ).join("\n");

    render(<FileContentDisplay {...defaultProps} fileContent={largeContent} />);

    expect(
      screen.getByText("대용량 파일 - 가상화 모드 (6,000줄)"),
    ).toBeInTheDocument();
  });
});
