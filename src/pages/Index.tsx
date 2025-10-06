import GeminiImageGenerator from "@/components/GeminiImageGenerator";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-6 text-center">Generador de imágenes - Gemini</h1>

        <div className="mb-8">
          <GeminiImageGenerator />
        </div>

        <div className="mt-8">
          <MadeWithDyad />
        </div>
      </div>
    </div>
  );
};

export default Index;