import { Chip, IconButton, Stack, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

export const PnlSectionHeader = ({
  title,
  open,
  onToggle,
  badge,
  action,
  testId,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  action?: React.ReactNode;
  testId?: string;
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" data-testid={testId}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ cursor: 'pointer', flex: 1, py: 0.25 }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={handleKeyDown}
      >
        <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
        {badge != null && (
          <Chip size="small" label={badge} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Stack>
      {action}
      <IconButton size="small" onClick={onToggle} sx={{ ml: 0.5 }} aria-label={open ? `Collapse ${title}` : `Expand ${title}`}>
        <ExpandMoreRoundedIcon
          fontSize="small"
          sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </IconButton>
    </Stack>
  );
};
