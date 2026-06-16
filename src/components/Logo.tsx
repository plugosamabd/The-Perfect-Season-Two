import logoAsset from "@/assets/logo.png.asset.json";

interface Props {
  className?: string;
  alt?: string;
}

export function Logo({ className = "h-8 w-auto", alt = "82-0" }: Props) {
  return <img src={logoAsset.url} alt={alt} className={className} draggable={false} />;
}

export const LOGO_URL = logoAsset.url;
