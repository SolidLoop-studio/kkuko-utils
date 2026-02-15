import React from "react";
import Spinner from "../components/Spinner";

const Loading = () => {
    return (
        <div className="flex flex-col flex-grow min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Spinner />
        </div>
    )
};

export default Loading;