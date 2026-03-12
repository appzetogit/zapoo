import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const FaviconManager = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let faviconHref = '/zapoo-icon.jpg'; // Default favicon

    if (path.startsWith('/admin')) {
      faviconHref = '/zapoo-icon.jpg';
    } else if (path.startsWith('/restaurant')) {
      faviconHref = '/zapoo-rest-logo.jpg';
    } else if (path.startsWith('/delivery')) {
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
    if (path.startsWith('/admin')) {
      document.title = 'Zapoo';
    } else if (path.startsWith('/restaurant')) {
      document.title = 'Zapoo';
    } else if (path.startsWith('/delivery')) {
      document.title = 'Zapoo';
    } else {
      document.title = 'Zapoo';
    }
  }, [location]);

  return null;
};

export default FaviconManager;
