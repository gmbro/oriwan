import Image from "next/image";

type TwttBrandMarkProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  label?: string;
  sizes?: string;
};

/**
 * Shared TWTT wordmark. The supplied asset has an opaque white background, so
 * the wrapper intentionally behaves like a white brand chip on dark surfaces.
 */
export function TwttBrandMark({
  className = "aspect-[640/310] w-[76px]",
  imageClassName = "object-contain",
  priority = false,
  label = "TWTT",
  sizes = "96px",
}: TwttBrandMarkProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden bg-white ${className}`}
      role="img"
      aria-label={label}
    >
      <Image
        src="/brand/twtt-logo.png"
        alt=""
        fill
        sizes={sizes}
        className={imageClassName}
        preload={priority}
      />
    </span>
  );
}
