"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/src/app/components/ui/dialog";
import Spinner from "@/src/app/components/Spinner";

type ModalProps = {
	isSaving: boolean;
	onClose: () => void;
	word: string;
	status: "add" | "delete" | "ok";
	isAdmin: boolean;
	isRequester: boolean;
	onAddAccept?: () => void;
	onDeleteAccept?: () => void;
	onAddReject?: () => void;
	onDeleteReject?: () => void;
	onCancelAddRequest?: () => void;
	onCancelDeleteRequest?: () => void;
	onDelete?: () => void;
	onRequestDelete?: () => void;
};

const WorkModal = ({
	isSaving,
	onClose,
	word,
	status,
	isAdmin,
	isRequester,
	onAddAccept,
	onDeleteAccept,
	onAddReject,
	onDeleteReject,
	onCancelAddRequest,
	onCancelDeleteRequest,
	onDelete,
	onRequestDelete,
}: ModalProps) => {
	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
				{/* Spinner Overlay */}
				{isSaving && (
					<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-lg">
						<Spinner />
					</div>
				)}
				<DialogHeader>
					<DialogTitle className="text-center text-gray-900 dark:text-gray-100">
						{word}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-2">
					{/* 상태 설명 */}
					<div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
						<span className="text-gray-700 dark:text-gray-200">
							{status === "add" && "현재 이 단어는 추가 요청 상태입니다."}
							{status === "delete" && "현재 이 단어는 삭제 요청 상태입니다."}
							{status === "ok" && "현재 등록된 단어입니다."}
						</span>
					</div>

					{/* 상태별 블록들 */}
					{status === "add" && (
						<>
							{isAdmin && (
								<>
									<ActionBlock
										text="추가 요청을 수락합니다."
										color="green"
										onClick={onAddAccept}
									/>
									<ActionBlock
										text="추가 요청을 거절합니다."
										color="red"
										onClick={onAddReject}
									/>
								</>
							)}
							{isRequester && (
								<ActionBlock
									text="추가 요청을 취소합니다."
									color="gray"
									onClick={onCancelAddRequest}
								/>
							)}
						</>
					)}

					{status === "delete" && (
						<>
							{isAdmin && (
								<>
									<ActionBlock
										text="삭제 요청을 수락합니다."
										color="green"
										onClick={onDeleteAccept}
									/>
									<ActionBlock
										text="삭제 요청을 거절합니다."
										color="red"
										onClick={onDeleteReject}
									/>
								</>
							)}
							{isRequester && (
								<ActionBlock
									text="삭제 요청을 취소합니다."
									color="gray"
									onClick={onCancelDeleteRequest}
								/>
							)}
						</>
					)}

					{status === "ok" && (
						<>
							{isAdmin && (
								<>
									<ActionBlock
										text="단어를 삭제합니다."
										color="red"
										onClick={onDelete}
									/>
								</>
							)}
							<ActionBlock
								text="삭제 요청을 보냅니다."
								color="yellow"
								onClick={onRequestDelete}
							/>
						</>
					)}
				</div>

				<DialogFooter className="mt-4">
					<button
						className="w-full bg-gray-300 dark:bg-gray-700 text-black dark:text-gray-100 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
						onClick={onClose}
					>
						닫기
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

// 액션 버튼 블록 컴포넌트
const ActionBlock = ({
	text,
	color,
	onClick,
	bg,
}: {
	text: string;
	color: "green" | "red" | "gray" | "yellow";
	onClick?: () => void;
	bg?: string;
}) => {
	const bgClass =
		bg ||
		{
			green: "bg-green-50 dark:bg-green-900",
			red: "bg-red-50 dark:bg-red-900",
			gray: "bg-gray-50 dark:bg-gray-800",
			yellow: "bg-yellow-50 dark:bg-yellow-900",
		}[color];

	const textClass = {
		green: "text-green-700 dark:text-green-200",
		red: "text-red-700 dark:text-red-200",
		gray: "text-gray-700 dark:text-gray-200",
		yellow: "text-yellow-700 dark:text-yellow-200",
	}[color];

	const buttonClass = {
		green: "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700",
		red: "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
		gray: "bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700",
		yellow: "bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700",
	}[color];

	return (
		<div className={`flex items-center justify-between ${bgClass} p-3 rounded-md`}>
			<span className={textClass}>{text}</span>
			<button
				className={`${buttonClass} text-white px-4 py-1 rounded-md`}
				onClick={onClick}
			>
				{text.includes("요청을 보") ? "요청" : "실행"}
			</button>
		</div>
	);
};

export default WorkModal;
