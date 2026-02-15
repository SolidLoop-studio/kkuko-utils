export default function ProgressBar({ completed, label }: { completed: number, label?: string }){
    return (
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
                className="bg-blue-600 h-4 rounded-full text-xs text-white flex items-center justify-center transition-all duration-300"
                style={{ width: `${completed}%` }}
            >
                {completed > 10 && `${completed}%`}
            </div>
            {label && <div className="text-xs text-center mt-1">{label}</div>}
        </div>
    );
};