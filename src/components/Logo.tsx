import logoAsset from "@/assets/logo.png.asset.json";

interface Props {
  className?: string;
  alt?: string;
}

export function Logo({ className = "h-14 w-auto sm:h-16 md:h-20", alt = "82-0" }: Props) {
  return <img src={logoAsset.url} alt={alt} className={className} draggable={false} />;
}

export const LOGO_URL = logoAsset.url;
