"use client";

import { Button } from "@/src/app/components/ui/button";
import { motion } from "framer-motion";

export default function ErrorPage({ message }: { message?: string }) {

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-red-50 dark:bg-red-950 p-4 text-center">
            <motion.h1
                className="text-4xl font-bold text-red-600 dark:text-red-300 mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                오류가 발생했습니다
            </motion.h1>
            <motion.p
                className="text-base text-red-500 dark:text-red-200 mb-6 whitespace-pre-line"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
            >
                {message ?? "데이터를 불러오는 중 문제가 발생했습니다."}
            </motion.p>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
            >
                <Button
                    variant="destructive"
                    onClick={() => window.location.reload()}
                    className="text-base px-6 py-3"
                >
                    새로고침
                </Button>
            </motion.div>
        </div>
    );
}
