import { Loader2 } from "lucide-react";

const Spinner = () => (
  <div className="flex justify-center items-center">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

export default Spinner;