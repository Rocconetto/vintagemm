import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

// A deliberately small router: three screens don't need a routing library.
// Navigation runs inside the View Transitions API when the browser supports it,
// which lets the garment photo morph between screens.

type Navigate = (to: string, options?: { replace?: boolean }) => void;
const RouterContext = createContext<{ path: string; navigate: Navigate }>({ path: '/', navigate: () => {} });

// Give the incoming photo a moment to decode so the morph lands on a real image.
async function waitForHeroImage() {
  const img = document.querySelector<HTMLImageElement>('img.vt-piece');
  if (!img) return;
  await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 350))]);
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate: Navigate = (to, options) => {
    if (to === window.location.pathname) return;
    const commit = () => {
      if (options?.replace) history.replaceState(null, '', to);
      else history.pushState(null, '', to);
      flushSync(() => setPath(to));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    if (document.startViewTransition && !reducedMotion()) {
      document.startViewTransition(async () => {
        commit();
        await waitForHeroImage();
      });
    } else commit();
  };

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
