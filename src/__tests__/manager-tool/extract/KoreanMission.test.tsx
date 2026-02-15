
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WordExtractorApp from "@/src/app/manager-tool/extract/korean-mission/KoreanMission";
import { getOutsideHelpModal } from "@/test/utils/dom";

jest.mock("@/app/manager-tool/extract/components/FileContentDisplay", () => {
  return ({ onFileUpload, fileContent, resultData, resultTitle }: any) => (
    <div data-testid="file-content-display">
      <div>File Content: {fileContent || "No content"}</div>
      <div>Result Title: {resultTitle}</div>
      <div>Result Count: {resultData?.length || 0}</div>
      <button onClick={() => onFileUpload?.("가나다라\n마바사아\n자차카타\n파하기나\n다람쥐\n바다거북")}>
        Mock File Upload
      </button>
      <div data-testid="result-word">{resultData}</div>
    </div>
  );
});

describe("KoreanMission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("초기 렌더링이 정상적으로 되는지 확인", () => {
    render(<WordExtractorApp />);

    expect(screen.getByText("한국어 미션단어 추출 - A")).toBeInTheDocument();
    expect(screen.getAllByText("설정")).toHaveLength(2);
    expect(screen.getAllByText("실행")).toHaveLength(2);
  });

  it("1미 포함 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const checkboxes = screen.getAllByTestId("checkbox");
    const oneMissionCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="one-mission"]')
    );

    if (oneMissionCheckbox) {
      expect(oneMissionCheckbox).not.toBeChecked();
      await user.click(oneMissionCheckbox);
      expect(oneMissionCheckbox).toBeChecked();
    }
  });

  it("미션 글자 표시 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const checkboxes = screen.getAllByTestId("checkbox");
    const missionLetterCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="show-mletter"]')
    );

    if (missionLetterCheckbox) {
      expect(missionLetterCheckbox).not.toBeChecked();
      await user.click(missionLetterCheckbox);
      expect(missionLetterCheckbox).toBeChecked();
    }
  });

  it("정렬 모드 체크박스가 정상적으로 동작하는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    const checkboxes = screen.getAllByTestId("checkbox");
    const sortCheckboxes = checkboxes.filter(
      (el) => !el.closest('[data-testid="help-modal"]') && 
      (el.closest('[id="sort-미션글자 포함순"]') || el.closest('[id="sort-글자길이순"]') || el.closest('[id="sort-ㄱㄴㄷ순"]'))
    );

    // 정렬 모드 체크박스들이 존재하는지 확인
    expect(sortCheckboxes.length).toBeGreaterThan(0);

    // 첫 번째 정렬 모드 체크박스 테스트
    if (sortCheckboxes[0]) {
      await user.click(sortCheckboxes[0]);
      expect(sortCheckboxes[0]).toBeChecked();
      expect(screen.getByText(/1순위/)).toBeInTheDocument();
    }
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

    // 정렬 모드 선택 (미션글자 포함순)
    const checkboxes = screen.getAllByTestId("checkbox");
    const missionSortCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="sort-미션글자 포함순"]')
    );

    if (missionSortCheckbox) {
      await user.click(missionSortCheckbox);
    }

    // 단어 추출 실행
    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    expect(extractButton).not.toBeDisabled();

    await user.click(extractButton);

    // 결과 확인 (미션 단어가 추출되어야 함)
    await waitFor(() => {
      const resultDisplay = screen.getByTestId("file-content-display");
      expect(resultDisplay).toHaveTextContent(/Result Count: [1-9]/);
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

    // 정렬 모드 선택
    const checkboxes = screen.getAllByTestId("checkbox");
    const missionSortCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="sort-미션글자 포함순"]')
    );

    if (missionSortCheckbox) {
      await user.click(missionSortCheckbox);
    }

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled();
    });
  });

  it("1미 포함 옵션이 제대로 적용되는지 확인", async () => {
    const user = userEvent.setup();
    render(<WordExtractorApp />);

    // 1미 포함 체크
    const checkboxes = screen.getAllByTestId("checkbox");
    const oneMissionCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="one-mission"]')
    );

    if (oneMissionCheckbox) {
      await user.click(oneMissionCheckbox);
    }

    // Mock 파일 업로드
    const mockUploadButton = screen.getByText("Mock File Upload");
    await user.click(mockUploadButton);

    // 정렬 모드 선택
    const missionSortCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="sort-미션글자 포함순"]')
    );

    if (missionSortCheckbox) {
      await user.click(missionSortCheckbox);
    }

    const extractButton = getOutsideHelpModal(() =>
      screen.getAllByText("단어 추출"),
    );
    await user.click(extractButton);

    // 1미 포함 옵션이 적용된 상태에서도 단어 추출이 동작해야 함
    await waitFor(() => {
      expect(screen.getByText(/Result Count: [1-9]/)).toBeInTheDocument();
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

    // 정렬 모드 선택
    const checkboxes = screen.getAllByTestId("checkbox");
    const missionSortCheckbox = checkboxes.find(
      (el) => !el.closest('[data-testid="help-modal"]') && el.closest('[id="sort-미션글자 포함순"]')
    );

    if (missionSortCheckbox) {
      await user.click(missionSortCheckbox);
    }

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
});
