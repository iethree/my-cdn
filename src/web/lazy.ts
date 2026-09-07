const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

// One shared observer: fire once when an element nears the viewport.
export function whenVisible(el: Element, cb: () => void): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer!.unobserve(e.target);
        callbacks.get(e.target)?.();
        callbacks.delete(e.target);
      }
    },
    { rootMargin: "300px" },
  );
  callbacks.set(el, cb);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    callbacks.delete(el);
  };
}
