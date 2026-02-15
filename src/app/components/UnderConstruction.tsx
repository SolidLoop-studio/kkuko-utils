'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/src/app/components/ui/button';

export default function UnderConstructionPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center space-y-6"
            >
                <div className="flex justify-center">
                    <Construction className="w-16 h-16 text-yellow-500 animate-bounce" />
                </div>
                <h1 className="text-3xl font-bold">페이지가 아직 제작 중입니다 🛠️</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                    더 좋은 서비스를 위해 열심히 개발 중입니다. 곧 찾아뵙겠습니다.
                </p>
                <div className="pt-4">
                    <Button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl shadow"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        이전 페이지로 돌아가기
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
