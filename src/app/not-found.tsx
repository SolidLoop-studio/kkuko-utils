import NotFound from "./not-found-client";

export async function generateMetadata() {
    return {
        title: "404 not found",
        description: 'not found',
    };
}

export default function notFound(){
    return <NotFound />
}