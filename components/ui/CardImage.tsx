"use client";

import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

type CardImageProps = {
  alt: string;
  imagePath?: string;
  className?: string;
  imageClassName?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

export function CardImage({ alt, imagePath, className = "", imageClassName = "", onClick, children }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imagePath]);

  if (!imagePath || failed) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} onClick={onClick}>
      <img
        alt={alt}
        className={`block w-full select-none rounded-md object-cover ${imageClassName}`}
        draggable={false}
        onError={() => setFailed(true)}
        src={imagePath}
      />
    </div>
  );
}
