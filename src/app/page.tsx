import React from 'react';
import Home from './Home';

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - Home",
        description: '끄코 유틸리티',
        openGraph: {
            title: "끄코 유틸리티 - Home",
            description: "끄코 유틸리티",
            type: "website",
            url: "https://kkuko-utils.vercel.app/",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const HomePage: React.FC = () => (
	<Home />
)

export default HomePage;
