import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  CssBaseline,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface LoginScreenProps {
  tenantId: string;
  username: string;
  password: string;
  loginError: string;
  loginLoading: boolean;
  onTenantIdChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const LoginScreen = ({
  tenantId,
  username,
  password,
  loginError,
  loginLoading,
  onTenantIdChange,
  onUsernameChange,
  onPasswordChange,
  onLogin,
}: LoginScreenProps) => (
  <>
    <CssBaseline />
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        background: 'linear-gradient(135deg, #0f172a 0%, #1a3a6b 50%, #0f172a 100%)',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        {/* Brand */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          >
            <ShowChartRoundedIcon sx={{ color: '#60a5fa', fontSize: 30 }} />
          </Avatar>
          <Box textAlign="center">
            <Typography variant="h4" fontWeight={800} sx={{ color: '#ffffff', letterSpacing: '-0.03em' }}>
              InAlgo
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: '0.15em', fontSize: '0.7rem' }}>
              TRADE ADMINISTRATION CONSOLE
            </Typography>
          </Box>
        </Stack>

        <Card sx={{ bgcolor: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <CardContent sx={{ p: 3.5, '&:last-child': { pb: 3.5 } }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>
              Sign In
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Tenant ID"
                value={tenantId}
                onChange={(e) => onTenantIdChange(e.target.value)}
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: <StorageRoundedIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
              <TextField
                label="Username"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: <AccountCircleRoundedIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                fullWidth
                size="small"
                onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              />
              {loginError && <Alert severity="error" sx={{ py: 0.5 }}>{loginError}</Alert>}
              <Button
                variant="contained"
                onClick={onLogin}
                disabled={loginLoading}
                fullWidth
                size="large"
                sx={{
                  py: 1.2,
                  background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                }}
              >
                {loginLoading ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', textAlign: 'center', mt: 2 }}>
          InAlgo Trade Platform · NSE/BSE Financial Data
        </Typography>
      </Box>
    </Box>
  </>
);
