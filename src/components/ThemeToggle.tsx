// src/components/ThemeToggle.tsx
import { IconButton, Tooltip } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ darkMode, onToggle }: ThemeToggleProps) {
  return (
    <Tooltip title={darkMode ? '切換到淺色模式' : '切換到深色模式'}>
      <IconButton
        onClick={onToggle}
        color='inherit'
        aria-label='切換主題'
        sx={{
          p: 1.5,
          borderRadius: '50%',
          bgcolor: 'background.paper',
          boxShadow: 1,
          color: 'text.primary',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
      >
        {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
      </IconButton>
    </Tooltip>
  );
}
