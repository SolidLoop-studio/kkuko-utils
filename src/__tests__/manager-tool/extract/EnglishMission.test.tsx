import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordExtractorApp from "@/src/app/manager-tool/extract/english-mission/EnglishMission";
import { getOutsideHelpModal } from "@/test/utils/dom";

jest.mock("@/app/manager-tool/extract/components/FileContentDisplay", () => {
  return ({ onFileUpload, fileContent, resultData, resultTitle }: any) => (
    <div data-testid="file-content-display">
      <div>File Content: {fileContent || "No content"}</div>
      <div>Result Title: {resultTitle}</div>
      <div data-testid="result-count">
        Result Count: {resultData?.length || 0}
      </div>
      <button
        onClick={() => onFileUpload?.("error\ncomputer\nnano\nemotionlessness")}
      >
        Mock File Upload
      </button>
      <div data-testid="result-word">{resultData}</div>
    </div>
  );
});

describe("EnglishMission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("초기 렌더링이 정상적으로 되는지 확인", () => {
    render(<WordExtractorApp />);

    expect(screen.getByText("영어 미션단어 추출")).toBeInTheDocument();
    expect(screen.getAllByText("설정")).toHaveLength(2);
    expect(screen.getAllByText("실행")).toHaveLength(2);
  });

  it("최소 포함수 입력이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const minMissionInput = screen
      .getAllByPlaceholderText("최소 포함수를 입력하세요")
      .find((el) => !el.closest('[data-testid="help-modal"]'));
    expect(minMissionInput).toBeDefined();
    await user.type(minMissionInput!, "2");

    expect(minMissionInput).toHaveValue(2);
  });

  it("결과 정렬 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const checkboxes = screen.getAllByTestId("checkbox");
    const sortCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]'),
    );

    expect(sortCheckbox).toBeDefined();
    expect(sortCheckbox).toBeChecked();

    await user.click(sortCheckbox!);
    expect(sortCheckbox).not.toBeChecked();
  });

  it("파일 내용이 없을 때 단어 추출 버튼이 비활성화되는지 확인", () => {
    render(<WordExtractorApp />);

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    expect(extractButton).toBeDisabled();
  });

  it("파일 업로드 후 단어 추출이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    // 최소 포함수 설정
    const minMissionInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("최소 포함수를 입력하세요"),
    );
    await user.clear(minMissionInput);
    await user.type(minMissionInput, "1");

    // 단어 추출 실행
    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    expect(extractButton).not.toBeDisabled();

    await user.click(extractButton);

    // 결과 확인 (미션 글자가 1개 이상 포함된 단어가 추출되어야 함)
    await waitFor(() => {
      const resultCountDisplay = screen.getByTestId("result-count");
      expect(resultCountDisplay).toHaveTextContent("Result Count: 4");
      const resultDataDisplay = screen.getByTestId("result-word");
      expect(resultDataDisplay).toHaveTextContent("error [r:3 e:1 o:1]");
    });
  });

  it("단어 추출 결과에 따라 다운로드 버튼이 활성화되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const downloadButton = getOutsideHelpModal(() =>
      screen.getAllByText("결과 다운로드"),
    );
    expect(downloadButton).toBeDisabled();

    // Mock 파일 업로드 및 단어 추출
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const minMissionInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("최소 포함수를 입력하세요"),
    );
    await user.clear(minMissionInput);
    await user.type(minMissionInput, "1");

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled();
    });
  });

  it("정렬 옵션이 제대로 적용되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // 정렬 해제
    const sortCheckbox = getOutsideHelpModal(() =>
      screen.getAllByTestId("checkbox"),
    );
    await user.click(sortCheckbox);

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const minMissionInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("최소 포함수를 입력하세요"),
    );
    await user.clear(minMissionInput);
    await user.type(minMissionInput, "1");

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    // 정렬이 해제된 상태에서도 단어 추출이 동작해야 함
    await waitFor(() => {
      const resultCountDisplay = screen.getByTestId("result-count");
      expect(resultCountDisplay).toHaveTextContent("Result Count: 4");
      const resultDataDisplay = screen.getByTestId("result-word");
      expect(resultDataDisplay).toHaveTextContent("error [e:1 o:1 r:3]");
    });
  });

  it("최소 포함수가 0 이하일 때 자동으로 양수로 설정되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const minMissionInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("최소 포함수를 입력하세요"),
    );

    await user.clear(minMissionInput);
    await user.type(minMissionInput, "-5");

    expect(minMissionInput).toHaveValue(5);
  });

  it("다운로드 기능이 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();

    // URL.createObjectURL mock 설정
    const createObjectURLSpy = jest.spyOn(URL, "createObjectURL");

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

    render(<WordExtractorApp />);

    // 단어 추출까지 완료
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const minMissionInput = getOutsideHelpModal(() =>
      screen.getAllByPlaceholderText("최소 포함수를 입력하세요"),
    );
    await user.clear(minMissionInput);
    await user.type(minMissionInput, "1");

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      const downloadButton = getOutsideHelpModal(() =>
        screen.getAllByText("결과 다운로드"),
      );
      expect(downloadButton).not.toBeDisabled();
    });

    // 다운로드 실행
    const downloadButton = getOutsideHelpModal(() =>
      screen.getAllByText("결과 다운로드"),
    );
    await user.click(downloadButton);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });

  it("파일의 총 단어 수가 정상적으로 표시되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    // 파일의 총 단어 수 표시 확인 (4개: error, computer, nano, emotionlessness)
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("파일의 총 단어 수")).toBeInTheDocument();
  });
});
