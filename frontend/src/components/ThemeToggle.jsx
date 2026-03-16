import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';

export const ThemeToggle = ({ className }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`h-9 w-9 lg:h-10 lg:w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 ${className}`}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 lg:h-6 lg:w-6 text-gray-700 hover:text-indigo-600 transition-colors" />
      ) : (
        <Sun className="h-5 w-5 lg:h-6 lg:w-6 text-yellow-400 hover:text-yellow-300 transition-colors" />
      )}
    </Button>
  );
};

export default ThemeToggle;
