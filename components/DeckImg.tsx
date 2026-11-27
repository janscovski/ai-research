import type { DeckImage } from "@/lib/schema";

/** Cached deck image with intrinsic size (no layout shift) and a 960/1920 srcset. */
export function DeckImg({
  image,
  alt,
  className = "",
  priority = false,
  sizes = "100vw",
  style,
}: {
  image: DeckImage;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}) {
  if (!image.src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images are already resized/encoded server-side
    <img
      src={image.srcSmall ?? image.src}
      srcSet={image.srcSmall ? `${image.srcSmall} 960w, ${image.src} 1920w` : undefined}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={className}
      style={{ objectPosition: image.focus ?? "50% 50%", ...style }}
    />
  );
}
