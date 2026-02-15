import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordExtractorApp from "@/src/app/manager-tool/extract/merge/Merge";
import { getOutsideHelpModal } from "@/test/utils/dom";
import { act } from "react";

describe("Merge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.FileReader = class {
      onload: ((event: any) => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      result: string | null = null;

      readAsText(file: File) {
        setTimeout(() => {
          if (file.name === "test1.txt") {
            this.result = "zebra\napple";
          } else if (file.name === "test2.txt") {
            this.result = "banana\napple";
          } else {
            this.result = "unknown";
          }

          this.onload?.({ target: { result: this.result } });
        }, 0);
      }
    } as any;
  });

  it("초기 렌더링이 정상적으로 되는지 확인", () => {
    render(<WordExtractorApp />);

    expect(screen.getByText("텍스트 파일 합성")).toBeInTheDocument();
    expect(screen.getByText("첫 번째 텍스트 파일")).toBeInTheDocument();
    expect(screen.getByText("두 번째 텍스트 파일")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getAllByText("실행")).toHaveLength(2);
  });

  it("정렬 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const sortCheckbox = screen.getByRole("checkbox", { name: /결과 정렬/i });

    expect(sortCheckbox).toBeChecked();

    await user.click(sortCheckbox);
    expect(sortCheckbox).not.toBeChecked();

    await user.click(sortCheckbox);
    expect(sortCheckbox).toBeChecked();
  });

  it("파일이 업로드되지 않았을 때 병합 버튼이 비활성화되는지 확인", () => {
    render(<WordExtractorApp />);

    const mergeButton = getOutsideHelpModal(() =>
      screen.getAllByRole("button", { name: /파일 병합/i }),
    );
    expect(mergeButton).toBeDisabled();
  });

  it("첫 번째 파일만 업로드되었을 때 병합 버튼이 비활성화되는지 확인", async () => {
    const user = userEvent.setup();
    await act(() => render(<WordExtractorApp />));

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const testFile = new File(["test\ncontent\ndata"], "test1.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile);

    await waitFor(() => {
      const mergeButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /파일 병합/i }),
      );
      expect(mergeButton).toBeDisabled();
    });
  });

  it("두 파일이 모두 업로드되면 병합 버튼이 활성화되는지 확인", async () => {
    const user = userEvent.setup();
    await act(() => render(<WordExtractorApp />));

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const file2Input = screen.getByLabelText("두 번째 텍스트 파일");

    const testFile1 = new File(["test\ncontent"], "test1.txt", {
      type: "text/plain",
    });
    const testFile2 = new File(["data\ntest"], "test2.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile1);
    await waitFor(async () => await user.upload(file2Input, testFile2));

    await waitFor(() => {
      const file1Display = screen.getByTestId("file-content-1");
      const file2Display = screen.getByTestId("file-content-2");
      expect(file1Display).toHaveTextContent("zebra apple");
      expect(file2Display).toHaveTextContent("banana apple");
      const mergeButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /파일 병합/i }),
      );
      expect(mergeButton).not.toBeDisabled();
    });
  });

  it("파일 병합이 정상적으로 동작하는지 확인 (정렬 활성화)", async () => {
    const user = userEvent.setup();
    await act(()=>render(<WordExtractorApp />))

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const file2Input = screen.getByLabelText("두 번째 텍스트 파일");

    const testFile1 = new File(["zebra\napple"], "test1.txt", {
      type: "text/plain",
    });
    const testFile2 = new File(["banana\napple"], "test2.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile1);
    await waitFor(async () => await user.upload(file2Input, testFile2));

    await waitFor(() => {
      const mergeButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /파일 병합/i }),
      );
      expect(mergeButton).not.toBeDisabled();
    });

    const mergeButton = getOutsideHelpModal(() =>
      screen.getAllByRole("button", { name: /파일 병합/i }),
    );
    await user.click(mergeButton);

    // 병합 결과 확인 (중복 제거 및 정렬)
    await waitFor(() => {
      const downloadButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /병합된 파일 다운로드/i }),
      );
      expect(downloadButton).not.toBeDisabled();
      const resultDisplay = screen.getByTestId("merged-content");
      expect(resultDisplay).toHaveTextContent("apple");
      expect(resultDisplay).toHaveTextContent("banana");
      expect(resultDisplay).toHaveTextContent("zebra");
      expect(resultDisplay.textContent).toBe("apple\nbanana\nzebra");
    });
  });

  it("파일 병합이 정상적으로 동작하는지 확인 (정렬 비활성화)", async () => {
    const user = userEvent.setup();
    await act(()=>render(<WordExtractorApp />));

    // 정렬 비활성화
    const sortCheckbox = getOutsideHelpModal(() =>
      screen.getAllByRole("checkbox", { name: /결과 정렬/i }),
    );
    await user.click(sortCheckbox);

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const file2Input = screen.getByLabelText("두 번째 텍스트 파일");

    const testFile1 = new File(["zebra\napple"], "test1.txt", {
      type: "text/plain",
    });
    const testFile2 = new File(["banana\napple"], "test2.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile1);
    await waitFor(async () => await user.upload(file2Input, testFile2));

    await waitFor(() => {
      const mergeButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /파일 병합/i }),
      );
      expect(mergeButton).not.toBeDisabled();
    });

    const mergeButton = getOutsideHelpModal(() =>
      screen.getAllByRole("button", { name: /파일 병합/i }),
    );
    await user.click(mergeButton);

    await waitFor(() => {
      const downloadButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /병합된 파일 다운로드/i }),
      );
      expect(downloadButton).not.toBeDisabled();
      const resultDisplay = screen.getByTestId("merged-content");
      expect(resultDisplay).toHaveTextContent("apple");
      expect(resultDisplay).toHaveTextContent("banana");
      expect(resultDisplay).toHaveTextContent("zebra");
    });
  });

  it("병합 결과가 없을 때 다운로드 버튼이 비활성화되는지 확인", () => {
    render(<WordExtractorApp />);

    const downloadButton = screen.getByRole("button", {
      name: /병합된 파일 다운로드/i,
    });
    expect(downloadButton).toBeDisabled();
  });

  it("다운로드 기능이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();

    // URL.createObjectURL mock 설정
    const createObjectURLSpy = jest.spyOn(URL, "createObjectURL");
    const revokeObjectURLSpy = jest.spyOn(URL, "revokeObjectURL");

    // createElement mock 설정
    const realCreateElement = document.createElement.bind(document);

    const mockLink = document.createElement("a");
    mockLink.click = jest.fn();

    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName) => {
        if (tagName === "a") return mockLink;
        return realCreateElement(tagName);
      });

    await act(()=>render(<WordExtractorApp />));

    // 파일 업로드 및 병합까지 완료
    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const file2Input = screen.getByLabelText("두 번째 텍스트 파일");

    const testFile1 = new File(["test\ncontent"], "test1.txt", {
      type: "text/plain",
    });
    const testFile2 = new File(["data\ntest"], "test2.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile1);
    await waitFor(async () => await user.upload(file2Input, testFile2));

    const mergeButton = getOutsideHelpModal(() =>
      screen.getAllByRole("button", { name: /파일 병합/i }),
    );
    await user.click(mergeButton);

    await waitFor(() => {
      const downloadButton = getOutsideHelpModal(() =>
        screen.getAllByRole("button", { name: /병합된 파일 다운로드/i }),
      );
      expect(downloadButton).not.toBeDisabled();
    });

    // 다운로드 실행
    const downloadButton = getOutsideHelpModal(() =>
      screen.getAllByRole("button", { name: /병합된 파일 다운로드/i }),
    );
    await user.click(downloadButton);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe("merged_file.txt");
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("첫 번째 파일 초기화가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    await act(()=>render(<WordExtractorApp />));

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const testFile = new File(["test content"], "test1.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile);

    // 파일이 업로드되었는지 확인
    await waitFor(() => {
      expect(screen.getByText("test1.txt")).toBeInTheDocument();
    });

    // 초기화 버튼 클릭
    const resetButtons = screen.getAllByText("초기화");
    await user.click(resetButtons[0]); // 첫 번째 파일의 초기화 버튼

    // 파일이 초기화되었는지 확인
    expect(screen.queryByText("test1.txt")).not.toBeInTheDocument();
  });

  it("모든 파일 초기화가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    await act(()=>render(<WordExtractorApp />));

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const file2Input = screen.getByLabelText("두 번째 텍스트 파일");

    const testFile1 = new File(["test content 1"], "test1.txt", {
      type: "text/plain",
    });
    const testFile2 = new File(["test content 2"], "test2.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile1);
    await waitFor(async () => await user.upload(file2Input, testFile2));

    // 파일들이 업로드되었는지 확인
    await waitFor(() => {
      expect(screen.getByText("test1.txt")).toBeInTheDocument();
      expect(screen.getByText("test2.txt")).toBeInTheDocument();
    });

    // 모든 파일 초기화 버튼 클릭
    const resetAllButton = screen.getByText("모든 파일 초기화");
    await user.click(resetAllButton);

    // 모든 파일이 초기화되었는지 확인
    expect(screen.queryByText("test1.txt")).not.toBeInTheDocument();
    expect(screen.queryByText("test2.txt")).not.toBeInTheDocument();
  });

  it("파일 크기 정보가 올바르게 표시되는지 확인", async () => {
    const user = userEvent.setup();
    await act(()=>render(<WordExtractorApp />));

    const file1Input = screen.getByLabelText("첫 번째 텍스트 파일");
    const testFile = new File(["test content for size check"], "test1.txt", {
      type: "text/plain",
    });

    await user.upload(file1Input, testFile);

    await waitFor(() => {
      // 파일 크기가 KB 단위로 표시되는지 확인
      const sizeElement = screen.getByText(/KB/);
      expect(sizeElement).toBeInTheDocument();
    });
  });
});
