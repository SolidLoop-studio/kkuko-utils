"use client";

import { useState } from "react";
import ErrorModal from "./components/ErrModal";
import type { ErrorMessage } from "./types/type";
import { useRouter } from "next/navigation";

const ErrorPage:React.FC<{e:ErrorMessage}> = ({e}) => {
    const [error,setError] = useState<ErrorMessage | null>(null);
    const router = useRouter();

    const goBack = () => {
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push("/");
        }
    };

    return (
        <div className="flex flex-col flex-grow min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {error && <ErrorModal error={e} onClose={()=>setError(null)} /> }

            <button
                onClick={goBack}
                className="mt-6 px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
                이전창으로 돌아가기
            </button>
        </div>
    )
}

export default ErrorPage;