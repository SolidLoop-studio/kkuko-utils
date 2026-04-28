import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordExtractorApp from "@/src/app/manager-tool/extract/containx/ContainX";
import { getOutsideHelpModal } from "@/test/utils/dom";

jest.mock("@/app/manager-tool/extract/components/FileContentDisplay", () => {
  return ({ onFileUpload, fileContent, resultData, resultTitle }: any) => (
    <div data-testid="file-content-display">
      <div>File Content: {fileContent || "No content"}</div>
      <div>Result Title: {resultTitle}</div>
      <div>Result Count: {resultData?.length || 0}</div>
      <button onClick={() => onFileUpload?.("test\ncontent\ndata\ntest")}>Mock File Upload</button>
      <div data-testid="result-word">{fileContent}</div>
    </div>
  );
});

describe("ContainX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("초기 렌더링이 정상적으로 되는지 확인", () => {
    render(<WordExtractorApp />);

    expect(screen.getByText("X가 포함된 단어 추출")).toBeInTheDocument();
    expect(screen.getAllByText("설정")).toHaveLength(2);
    expect(screen.getAllByText("실행")).toHaveLength(2);
  });

  it("포함글자 입력이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const wordIncludeInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("포함글자를 입력하세요"),
    );
    expect(wordIncludeInput).toBeDefined();

    await user.type(wordIncludeInput!, "te");
    expect(wordIncludeInput).toHaveValue("te");
  });

  it("파일 내용이 없을 때 단어 추출 버튼이 비활성화되는지 확인", () => {
    render(<WordExtractorApp />);

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    expect(extractButton).toBeDisabled();
  });

  it("파일 업로드 후 포함 단어 추출이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const wordIncludeInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("포함글자를 입력하세요"),
    );
    await user.type(wordIncludeInput, "te");

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      const resultDisplay = screen.getByTestId("file-content-display");
      expect(resultDisplay).toHaveTextContent("Result Count: 2");
    });
  });

  it("단어 추출 결과에 따라 다운로드 버튼이 활성화되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const downloadButton = getOutsideHelpModal(() =>
      screen.getAllByText("결과 다운로드"),
    );
    expect(downloadButton).toBeDisabled();

    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const wordIncludeInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("포함글자를 입력하세요"),
    );
    await user.type(wordIncludeInput, "te");

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled();
    });
  });
});
