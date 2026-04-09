import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const FaviconManager = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let faviconHref = '/zapoo-icon.jpg'; // Default favicon
    const isModulePath = (base) => path === base || path.startsWith(`${base}/`);

    if (isModulePath('/admin')) {
      faviconHref = '/zapoo-icon.jpg';
    } else if (isModulePath('/restaurant')) {
      faviconHref = '/zapoo-rest-logo.jpg';
    } else if (isModulePath('/delivery')) {
      faviconHref = '/zapoo-delivery-icon.jpg';
    }

    const setFavicon = (href) => {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = href;

      // Also update shortcut icon if it exists
      let shortcutLink = document.querySelector("link[rel='shortcut icon']");
      if (shortcutLink) {
        shortcutLink.href = href;
      }
    };

    setFavicon(faviconHref);

    // Update title as well if needed, though usually handled by page components
    if (isModulePath('/admin')) {
      document.title = 'Zapoo';
    } else if (isModulePath('/restaurant')) {
      document.title = 'Zapoo';
    } else if (isModulePath('/delivery')) {
      document.title = 'Zapoo';
    } else {
      document.title = 'Zapoo';
    }
  }, [location]);

  return null;
};

export default FaviconManager;
