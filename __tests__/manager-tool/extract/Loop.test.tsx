import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoopWordExtractorApp from "@/app/manager-tool/extract/loop/Loop";
import { getOutsideHelpModal } from "@/test/utils/dom";

// FileContentDisplay 컴포넌트 모킹
jest.mock("@/app/manager-tool/extract/components/FileContentDisplay", () => {
	return ({ onFileUpload, fileContent, resultData, resultTitle }: any) => (
		<div data-testid="file-content-display">
			<div>File Content: {fileContent || "No content"}</div>
			<div>Result Title: {resultTitle}</div>
			<div data-testid="result-count">Result Count: {resultData?.length || 0}</div>
			<button
				onClick={() =>
					onFileUpload?.(
						"라미아벨라 라메디아노체루나라 나라 나를인간이라고부르지말라 라그나로스님의힘이느껴지는구나 라바하운드와불타오르는아레나 나가르주나",
					)
				}
			>
				Mock File Upload
			</button>
			<div data-testid="result-word">{resultData?.join(" ")}</div>
		</div>
	);
});

// DuemLaw 함수 모킹
jest.mock("@/app/lib/hangulUtils", () => {
	return jest.fn((char: string) => {
		// 두음법칙 매핑
		const duemMap: { [key: string]: string } = {
			라: "나",
		};
		return duemMap[char] || char;
	});
});

describe("Loop", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("초기 렌더링이 정상적으로 되는지 확인", () => {
		render(<LoopWordExtractorApp />);

		expect(screen.getAllByText("설정")).toHaveLength(2);
		expect(screen.getAllByText("실행")).toHaveLength(2);
		expect(screen.getByText("추출 모드")).toBeInTheDocument();
	});

	it("돌림글자 입력이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		const loopLetterInput = screen
			.getAllByPlaceholderText("돌림글자를 입력하세요")
			.find((el) => !el.closest('[data-testid="help-modal"]'));
		expect(loopLetterInput).toBeDefined();
		await user.type(loopLetterInput!, "라");

		expect(loopLetterInput).toHaveValue("라");
	});

	it("정렬 체크박스가 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		const checkboxes = screen
			.getAllByRole("checkbox")
			.filter((el) => !el.closest('[data-testid="help-modal"]'));
		const sortCheckbox = checkboxes[0]; // 첫 번째 체크박스가 정렬 옵션

		expect(sortCheckbox).toBeDefined();
		expect(sortCheckbox).toBeChecked();

		await user.click(sortCheckbox);
		expect(sortCheckbox).not.toBeChecked();
	});

	it("추출 모드 선택이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		const mode1Radio = screen.getByTestId('test-mode1');
		const mode2Radio = screen.getByTestId('test-mode2');
		const mode3Radio = screen.getByTestId('test-mode3');
		const mode4Radio = screen.getByTestId('test-mode4');

		// 초기에는 아무것도 선택되지 않음
		expect(mode1Radio).not.toBeChecked();
		expect(mode2Radio).not.toBeChecked();
		expect(mode3Radio).not.toBeChecked();
		expect(mode4Radio).not.toBeChecked();

		// 모드 1 선택
		await user.click(mode1Radio);
		expect(mode1Radio).toBeChecked();
		expect(mode2Radio).not.toBeChecked();

		// 모드 2로 변경
		await user.click(mode2Radio);
		expect(mode1Radio).not.toBeChecked();
		expect(mode2Radio).toBeChecked();
	});

	it("파일 내용이 없을 때 돌림단어 추출 버튼이 비활성화되는지 확인", () => {
		render(<LoopWordExtractorApp />);

		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		expect(extractButton).toBeDisabled();
	});

	it("필수 조건이 충족되지 않으면 돌림단어 추출 버튼이 비활성화되는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// 파일만 업로드
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		const extractButton = getOutsideHelpModal(() =>
				screen.getAllByRole("button", { name: "돌림단어 추출" }),
			);
		expect(extractButton).toBeDisabled(); // 돌림글자와 모드가 없으므로 비활성화
		// 돌림글자 입력
		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		expect(extractButton).toBeDisabled(); // 모드가 없으므로 여전히 비활성화

		// 모드 선택
		const mode1Radio = screen.getByTestId('test-mode1');
		await user.click(mode1Radio);

		expect(extractButton).not.toBeDisabled(); // 모든 조건 충족
	});

	it("모드 1 돌림단어 추출이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// Mock 파일 업로드 (라메디아노체루나라, 나라, 라미아벨라, 나를인간이라고부르지말라, 라그나로스님의힘이느껴지는구나, 라바하운드와불타오르는아레나, 나가르주나)
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		// 돌림글자 입력
		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		// 모드 1 선택 (시작=끝)
		const mode1Radio = screen.getByTestId('test-mode1');
		await user.click(mode1Radio);

		// 돌림단어 추출 실행
		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		// 결과 확인
		await waitFor(() => {
			const resultDisplay = screen.getByTestId("result-count");
			expect(resultDisplay).toHaveTextContent("Result Count: 2");
			const resultWord = screen.getByTestId("result-word");
			expect(resultWord).toHaveTextContent("라메디아노체루나라");
			expect(resultWord).toHaveTextContent("라미아벨라");
		});
	});

	it("모드 2 돌림단어 추출이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// Mock 파일 업로드
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		// 돌림글자 입력
		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		// 모드 2 선택 (시작(두음법칙)=끝)
		const mode2Radio = screen.getByTestId('test-mode2');
		await user.click(mode2Radio);

		// 돌림단어 추출 실행
		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		// 결과 확인 (라메디아노체루나라, 나라, 라미아벨라, 나를인간이라고부르지말라)
		await waitFor(() => {
			const resultDisplay = screen.getByTestId("file-content-display");
			expect(resultDisplay).toHaveTextContent("Result Count: 4");
			const resultWord = screen.getByTestId("result-word");
			expect(resultWord).toHaveTextContent("라메디아노체루나라");
			expect(resultWord).toHaveTextContent("라미아벨라");
			expect(resultWord).toHaveTextContent("나라");
			expect(resultWord).toHaveTextContent("나를인간이라고부르지말라");
		});
	});

	it("모드 3 돌림단어 추출이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// Mock 파일 업로드
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		// 돌림글자 입력
		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		// 모드 3 선택
		const mode3Radio = screen.getByTestId('test-mode3');
		await user.click(mode3Radio);

		// 돌림단어 추출 실행
		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		// 결과 확인 (라메디아노체루나라, 라미아벨라, 라그나로스님의힘이느껴지는구나, 라바하운드와불타오르는아레나)
		await waitFor(() => {
			const resultDisplay = screen.getByTestId("file-content-display");
			expect(resultDisplay).toHaveTextContent("Result Count: 4");
			const resultWord = screen.getByTestId("result-word");
			expect(resultWord).toHaveTextContent("라메디아노체루나라");
			expect(resultWord).toHaveTextContent("라미아벨라");
			expect(resultWord).toHaveTextContent("라그나로스님의힘이느껴지는구나");
			expect(resultWord).toHaveTextContent("라바하운드와불타오르는아레나");
		});
	});

	it("모드 4 돌림단어 추출이 정상적으로 동작하는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// Mock 파일 업로드
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		// 돌림글자 입력
		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		// 모드 4 선택
		const mode4Radio = screen.getByTestId('test-mode4');
		await user.click(mode4Radio);

		// 돌림단어 추출 실행
		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		// 결과 확인 (라메디아노체루나라, 나라, 라미아벨라, 나를인간이라고부르지말라, 라그나로스님의힘이느껴지는구나, 라바하운드와불타오르는아레나, 나가르주나)
		await waitFor(() => {
			const resultDisplay = screen.getByTestId("file-content-display");
			expect(resultDisplay).toHaveTextContent("Result Count: 7");
			const resultWord = screen.getByTestId("result-word");
			expect(resultWord).toHaveTextContent("라메디아노체루나라");
			expect(resultWord).toHaveTextContent("라미아벨라");
			expect(resultWord).toHaveTextContent("나라");
			expect(resultWord).toHaveTextContent("나를인간이라고부르지말라");
			expect(resultWord).toHaveTextContent("라그나로스님의힘이느껴지는구나");
			expect(resultWord).toHaveTextContent("라바하운드와불타오르는아레나");
			expect(resultWord).toHaveTextContent("나가르주나");
		});
	});

	it("다운로드 버튼이 추출 결과에 따라 활성화되는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		const downloadButton = getOutsideHelpModal(() =>
			screen.getAllByText("결과 다운로드"),
		);
		expect(downloadButton).toBeDisabled();

		// Mock 파일 업로드 및 단어 추출
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		const mode1Radio = screen.getByTestId('test-mode1');
		await user.click(mode1Radio);

		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		await waitFor(() => {
			expect(downloadButton).not.toBeDisabled();
		});
	});

	it("정렬 옵션이 제대로 적용되는지 확인", async () => {
		const user = userEvent.setup();
		render(<LoopWordExtractorApp />);

		// 정렬 해제
		const sortCheckbox = screen
			.getAllByRole("checkbox")
			.filter((el) => !el.closest('[data-testid="help-modal"]'))[0];
		await user.click(sortCheckbox);

		// Mock 파일 업로드
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		const mode1Radio = screen.getByTestId('test-mode1');
		await user.click(mode1Radio);

		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
		);
		await user.click(extractButton);

		// 정렬이 해제된 상태에서도 단어 추출이 동작해야 함 // 라미아벨라 라메디아노체루나라
		await waitFor(() => {
			const resultDisplay = screen.getByTestId("file-content-display");
			expect(resultDisplay).toHaveTextContent("Result Count: 2");
			const resultWord = screen.getByTestId("result-word");
			expect(resultWord).toHaveTextContent("라미아벨라 라메디아노체루나라");
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

		render(<LoopWordExtractorApp />);

		// 돌림단어 추출까지 완료
		const mockUploadButton = screen.getByText("Mock File Upload");
		await user.click(mockUploadButton);

		const loopLetterInput = getOutsideHelpModal(() =>
			screen.getAllByPlaceholderText("돌림글자를 입력하세요"),
		);
		await user.type(loopLetterInput, "라");

		const mode1Radio = screen.getByTestId('test-mode1');
		await user.click(mode1Radio);

		const extractButton = getOutsideHelpModal(() =>
			screen.getAllByRole("button", { name: "돌림단어 추출" }),
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
