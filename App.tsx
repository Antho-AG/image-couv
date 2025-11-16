import React, { useState, useCallback, useEffect } from 'react';
import { editImage } from './services/geminiService';

// --- Helper Functions ---
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const parseDataUrl = (dataUrl: string): { base64: string; mimeType: string } => {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL format');
    return { mimeType: match[1], base64: match[2] };
}

// --- SVG Icon Components ---
const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 16l-4 4 4-4 3.293-3.293a1 1 0 011.414 0L20 17" />
  </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


// --- UI Components ---

interface LoaderProps {
  message: string;
}
const Loader: React.FC<LoaderProps> = ({ message }) => (
  <div className="fixed inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex flex-col justify-center items-center z-50">
    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
    <p className="text-white text-xl mt-4 tracking-wider">{message}</p>
  </div>
);

const Header: React.FC = () => (
  <header className="py-6 px-4 sm:px-6 lg:px-8 text-center">
    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
      Nano Banana Image Editor
    </h1>
    <p className="mt-2 text-lg text-gray-300 max-w-2xl mx-auto">
      Bring your creative visions to life. Upload an image, describe your edits, and let AI do the magic.
    </p>
  </header>
);

interface ImageUploaderProps {
  imagePreviewUrl: string | null;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}
const ImageUploader: React.FC<ImageUploaderProps> = ({ imagePreviewUrl, onImageChange, disabled }) => (
  <div className="w-full">
    <label htmlFor="image-upload" className={`relative block w-full aspect-video border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300 ${disabled ? 'cursor-not-allowed opacity-50' : 'border-gray-600 hover:border-indigo-400'}`}>
      {imagePreviewUrl ? (
        <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl" />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-center items-center text-gray-400">
          <ImageIcon className="w-16 h-16 mb-2" />
          <span className="font-semibold">Click to upload an image</span>
          <span className="text-sm">PNG, JPG, WEBP supported</span>
        </div>
      )}
      <input 
        id="image-upload" 
        type="file" 
        className="sr-only" 
        accept="image/png, image/jpeg, image/webp"
        onChange={onImageChange}
        disabled={disabled}
      />
    </label>
  </div>
);

interface ImageDisplayProps {
  originalUrl: string | null;
  generatedUrl: string | null;
}
const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalUrl, generatedUrl }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
    <div className="flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Original</h3>
        <div className="w-full aspect-video bg-gray-800/50 rounded-xl flex items-center justify-center overflow-hidden">
            {originalUrl ? <img src={originalUrl} alt="Original" className="w-full h-full object-contain" /> : <p className="text-gray-500">Upload an image to start</p>}
        </div>
    </div>
    <div className="flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Generated</h3>
        <div className="w-full aspect-video bg-gray-800/50 rounded-xl flex items-center justify-center overflow-hidden">
            {generatedUrl ? <img src={generatedUrl} alt="Generated by AI" className="w-full h-full object-contain" /> : <SparklesIcon className="w-16 h-16 text-indigo-500/50" />}
        </div>
    </div>
  </div>
);


// --- Main App Component ---

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(
    "L'image que j'envoie doit être utilisée comme couverture d'un livre qui sera placé dans un décor correspondant à l'image de base tout en restant naturel. L'image du livre ne doit pas être modifiée, c'est-à-dire garder la même typographie, même couleur, mêmes dessins."
  );
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clean up object URL
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setGeneratedImageUrl(null);
      setError(null);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!imageFile || !prompt) {
      setError("Please upload an image and provide a prompt.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      const dataUrl = await fileToDataUrl(imageFile);
      const { base64, mimeType } = parseDataUrl(dataUrl);
      const resultUrl = await editImage(base64, mimeType, prompt);
      setGeneratedImageUrl(resultUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, prompt]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {isLoading && <Loader message="Generating your image..." />}
      <Header />
      
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left Column: Controls */}
          <div className="flex flex-col gap-6 p-6 bg-gray-800/50 rounded-2xl shadow-lg">
            <div>
                <h2 className="text-xl font-bold mb-3 text-indigo-300">1. Upload Image</h2>
                <ImageUploader imagePreviewUrl={imagePreviewUrl} onImageChange={handleImageChange} disabled={isLoading} />
            </div>
            <div>
                <h2 className="text-xl font-bold mb-3 text-indigo-300">2. Describe Your Edit</h2>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Add a retro filter, remove the person in the background"
                  className="w-full h-40 p-3 bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-none disabled:opacity-50"
                  disabled={isLoading}
                />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !imageFile || !prompt}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 text-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <SparklesIcon className="w-6 h-6" />
              Generate
            </button>
            {error && (
                <div className="flex items-center gap-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
                    <ErrorIcon className="w-6 h-6 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
          </div>

          {/* Right Column: Display */}
          <div className="p-6 bg-gray-800/50 rounded-2xl shadow-lg">
            <ImageDisplay originalUrl={imagePreviewUrl} generatedUrl={generatedImageUrl} />
          </div>
        </div>
      </main>
    </div>
  );
}
