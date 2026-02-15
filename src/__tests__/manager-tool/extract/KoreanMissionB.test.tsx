
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordExtractorApp from "@/src/app/manager-tool/extract/korean-mission-b/KoreanMissionB";
import { getOutsideHelpModal } from "@/test/utils/dom";

jest.mock("@/app/manager-tool/extract/components/FileContentDisplay", () => {
  return ({ onFileUpload, fileContent, resultData, resultTitle }: any) => (
    <div data-testid="file-content-display">
      <div>File Content: {fileContent || "No content"}</div>
      <div>Result Title: {resultTitle}</div>
      <div>Result Count: {resultData?.length || 0}</div>
      <button onClick={() => onFileUpload("테스트 단어들 기가막힌 감자 나라 다람쥐 마법사 바다 사자 아름다운 자연 차가운 카페 타이어 파티 하늘")}>
        Mock File Upload
      </button>
      <div data-testid="result-word">{resultData}</div>
    </div>
  );
});

describe("KoreanMissionB", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("초기 렌더링이 정상적으로 되는지 확인", () => {
    render(<WordExtractorApp />);

    expect(screen.getByText("한국어 미션 단어 추출 - B")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getAllByText("실행")).toHaveLength(2);
  });

  it("미션글자 표시 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const checkboxes = screen.getAllByTestId("checkbox");
    const missionLetterCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]'),
    );

    expect(missionLetterCheckbox).toBeDefined();
    expect(missionLetterCheckbox).not.toBeChecked();

    await user.click(missionLetterCheckbox!);
    expect(missionLetterCheckbox).toBeChecked();
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

    // 단어 추출 실행
    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    expect(extractButton).not.toBeDisabled();

    await user.click(extractButton);

    // 결과 확인 (1티어 미션단어가 추출되어야 함)
    await waitFor(() => {
      const resultWord = screen.getByTestId("result-word");
      expect(resultWord).toBeInTheDocument();
      expect(resultWord).toHaveTextContent(/기가막힌/)
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

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled();
    });
  });

  it("미션글자 표시 옵션이 제대로 적용되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // 미션글자 표시 체크
    const missionLetterCheckbox = getOutsideHelpModal(() =>
      screen.getAllByTestId("checkbox"),
    );
    await user.click(missionLetterCheckbox);

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    // 미션글자 표시 옵션이 활성화된 상태에서도 단어 추출이 동작해야 함
    await waitFor(() => {
      const resultWord = screen.getByTestId("result-word");
      expect(resultWord).toBeInTheDocument();
      expect(resultWord).toHaveTextContent(/[가1]/)
    });
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

  it("파일 내용이 있을 때 파일 단어 수가 표시되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    // 파일 단어 수가 표시되어야 함
    await waitFor(() => {
      expect(screen.getByText("파일의 총 단어 수")).toBeInTheDocument();
    });
  });
});
