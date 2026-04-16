import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    // Check if theme is saved in localStorage
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      return savedTheme;
    }
    const savedAppearance = localStorage.getItem('userAppearance');
    if (savedAppearance) {
      return savedAppearance;
    }
    // Default to light
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Check if we are in admin, restaurant or delivery module
    const isSpecialModule = /^\/(admin|restaurant|delivery)/.test(location.pathname);

    // Remove both classes first
    root.classList.remove('light', 'dark');

    if (isSpecialModule) {
      // Force light theme for these modules
      root.classList.add('light');
    } else {
      // Add the current theme class for customer module
      root.classList.add(theme);
    }
  }, [theme, location.pathname]);

  useEffect(() => {
    const persistTheme = () => {
      localStorage.setItem('appTheme', theme);
      localStorage.setItem('userAppearance', theme);
    };

    const syncThemeFromStorage = () => {
      const savedTheme = localStorage.getItem('userAppearance') || localStorage.getItem('appTheme');
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme);
      }
    };

    persistTheme();
    window.addEventListener('userAppearanceChanged', syncThemeFromStorage);
    window.addEventListener('storage', syncThemeFromStorage);

    return () => {
      window.removeEventListener('userAppearanceChanged', syncThemeFromStorage);
      window.removeEventListener('storage', syncThemeFromStorage);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
