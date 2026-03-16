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
    
    // Save to localStorage
    localStorage.setItem('appTheme', theme);
  }, [theme, location.pathname]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
