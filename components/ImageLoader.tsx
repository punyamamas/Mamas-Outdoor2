import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  containerClassName?: string;
}

const ImageLoader: React.FC<ImageLoaderProps> = ({ className, containerClassName, src, alt, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <>
      {/* Placeholder / Skeleton saat loading */}
      {!isLoaded && !hasError && (
        <div className={`absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10 ${containerClassName}`}>
           <ImageIcon className="text-gray-300 w-8 h-8 opacity-50" />
        </div>
      )}

      {/* Fallback jika gambar error/broken */}
      {hasError && (
        <div className={`absolute inset-0 bg-gray-100 flex flex-col items-center justify-center z-10 text-gray-400 p-4 text-center ${containerClassName}`}>
           <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
           <span className="text-[10px]">Gambar Rusak</span>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-700 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
        decoding="async"
        {...props}
      />
    </>
  );
};

export default ImageLoader;