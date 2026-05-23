"use client";

import { CardImage } from "@/components/ui/CardImage";
import type { BaseCard } from "@/lib/game/types";

type CardPreviewModalProps = {
  card?: BaseCard;
  onClose: () => void;
};

export function CardPreviewModal({ card, onClose }: CardPreviewModalProps) {
  if (!card) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
        <button
          aria-label="Close card preview"
          className="mb-2 w-full rounded-md border border-stone-300 bg-white/50 px-3 py-2 text-sm font-medium text-stone-900 shadow-sm backdrop-blur-sm hover:bg-stone-50/65"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
        <CardImage
          alt={card.name}
          className="rounded-lg bg-white/55 p-2 shadow-2xl backdrop-blur-sm"
          imageClassName="max-h-[82vh] object-contain"
          imagePath={card.imagePath}
        >
          <div className="rounded-md border border-stone-300 bg-white/50 p-6 text-center backdrop-blur-sm">
            <h2 className="text-xl font-bold text-stone-950">{card.name}</h2>
            {card.description ? <p className="mt-3 text-sm text-stone-700">{card.description}</p> : null}
          </div>
        </CardImage>
      </div>
    </div>
  );
}
