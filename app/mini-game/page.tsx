import Providers from "./providers";
import Game from "./game/Game";

const MiniGamePage = () => {
    return (
        <Providers>
            <div className="flex justify-center mt-8">
                <Game />
            </div>
        </Providers>
    );
};

export default MiniGamePage;