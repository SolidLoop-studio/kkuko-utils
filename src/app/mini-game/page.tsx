import Providers from "./providers";
import Game from "./game/Game";
import MobileUnsupported from "./MobileUnsupported";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 미니 게임",
		description: '끄코 유틸리티 - 미니 게임',
	};
}

const MiniGamePage = () => {
    return (
        <Providers>
            {/* Game visible on medium and larger screens */}
            <div className="hidden md:flex justify-center mt-8 mb-16">
                <Game />
            </div>

            {/* Mobile-only message */}
            <MobileUnsupported />
        </Providers>
    );
};

export default MiniGamePage;