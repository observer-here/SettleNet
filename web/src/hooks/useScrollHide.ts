import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function useScrollHide(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setHidden(false);
  }, [pathname]);

  useEffect(() => {
    let last = window.scrollY || document.documentElement.scrollTop;
    let ticking = false;

    const readY = () => window.scrollY || document.documentElement.scrollTop || 0;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.max(0, readY());
        const dy = y - last;
        if (y < 48) setHidden(false);
        else if (dy > threshold) setHidden(true);
        else if (dy < -threshold) setHidden(false);
        last = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [threshold]);

  return hidden;
}
