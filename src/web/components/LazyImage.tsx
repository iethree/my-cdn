import { useEffect, useRef, useState } from "react";
import { whenVisible } from "../lazy";

export function LazyImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => (ref.current ? whenVisible(ref.current, () => setVisible(true)) : undefined), []);
  return <img ref={ref} src={visible ? src : undefined} alt={alt} loading="lazy" decoding="async" />;
}
