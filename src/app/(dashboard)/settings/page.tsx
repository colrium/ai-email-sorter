"use client";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle,
  Error as ErrorIcon,
  Star as StarIcon,
  StarOutline as StarOutlineIcon,
} from "@mui/icons-material";
import { DashboardLayoutClient } from "@/components/common/DashboardLayout";
import { useState, useEffect } from "react";

interface GmailAccount {
  id: string;
  email: string;
  isPrimary: boolean;
  isActive: boolean;
  syncStatus: string;
  lastSyncAt: string | null;
  emailCount: number;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Fetch accounts
  useEffect(() => {
    fetchAccounts();

    // Check for success/error messages from OAuth callback
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get("success");
    const errorParam = params.get("error");

    if (successParam === "account_connected") {
      setSuccess("Gmail account connected successfully!");
      // Clear URL parameters
      window.history.replaceState({}, "", "/settings");
    } else if (successParam === "account_updated") {
      setSuccess("Gmail account tokens updated successfully!");
      window.history.replaceState({}, "", "/settings");
    } else if (errorParam) {
      setError(`Failed to connect account: ${errorParam}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/accounts");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  // Connect new account
  const handleConnectAccount = () => {
    setConnecting(true);

    // Build Google OAuth URL
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/accounts/connect/callback`;
    const scope = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId || "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    console.log('Connecting to Google OAuth URL:', authUrl.toString());
    console.log('Connecting to Google OAuth URL redirectUri:', redirectUri);
    // Redirect to Google OAuth
    window.location.href = authUrl.toString();
  };

  // Disconnect account
  const handleDisconnectAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to disconnect account");

      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  // Refresh account
  const handleRefreshAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to refresh account");

      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  };

  // Set primary account
  const handleSetPrimary = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/set-primary`, {
        method: "PATCH",
      });

      if (!response.ok) throw new Error("Failed to set primary account");

      setSuccess("Primary account updated successfully!");
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set primary");
    }
  };

  return (
    <DashboardLayoutClient>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your account and Gmail connections
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}

        {/* Gmail Accounts */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6">Connected Gmail Accounts</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleConnectAccount}
                disabled={connecting}
              >
                {connecting ? "Connecting..." : "Connect Account"}
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
              </Box>
            ) : accounts.length === 0 ? (
              <Alert severity="info">
                No Gmail accounts connected. Click &quot;Connect Account&quot;
                to add one.
              </Alert>
            ) : (
              <List>
                {accounts.map((account) => (
                  <ListItem
                    key={account.id}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography variant="subtitle1">
                            {account.email}
                          </Typography>
                          {account.isActive ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                          {account.isPrimary && (
                            <Chip
                              icon={<StarIcon />}
                              label="Primary"
                              color="primary"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            gap: 1,
                            mt: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Chip
                            label={account.syncStatus}
                            size="small"
                            color={
                              account.syncStatus === "active"
                                ? "success"
                                : "default"
                            }
                          />
                          <Chip
                            label={`${account.emailCount} emails`}
                            size="small"
                            variant="outlined"
                          />
                          {account.lastSyncAt && (
                            <Chip
                              label={`Last sync: ${new Date(
                                account.lastSyncAt
                              ).toLocaleString()}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondaryTypographyProps={{
                        component: "div",
                      }}
                    />
                    <ListItemSecondaryAction>
                      {!account.isPrimary && (
                        <IconButton
                          edge="end"
                          onClick={() => handleSetPrimary(account.id)}
                          sx={{ mr: 1 }}
                          title="Set as primary account"
                        >
                          <StarOutlineIcon />
                        </IconButton>
                      )}
                      <IconButton
                        edge="end"
                        onClick={() => handleRefreshAccount(account.id)}
                        sx={{ mr: 1 }}
                        title="Refresh account"
                      >
                        <RefreshIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDisconnectAccount(account.id)}
                        disabled={account.isPrimary}
                        title={
                          account.isPrimary
                            ? "Cannot disconnect primary account"
                            : "Disconnect account"
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Additional Settings */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Preferences
            </Typography>
            <Alert severity="info">Additional preferences coming soon.</Alert>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayoutClient>
  );
}
