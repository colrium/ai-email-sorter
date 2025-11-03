"use client";

import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Typography,
  FormControlLabel,
  Switch,
  TextField,
  Box,
} from "@mui/material";
import { CloudDownload as ImportIcon } from "@mui/icons-material";

interface ImportButtonProps {
  accountId?: string;
  onImportComplete?: () => void;
}

export default function ImportButton({
  accountId,
  onImportComplete,
}: ImportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [maxResults, setMaxResults] = useState(20);
  const [autoArchive, setAutoArchive] = useState(true);

  const handleImport = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await fetch("/api/emails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          maxResults,
          autoArchive,
          query: "in:inbox",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import emails");
      }

      setResult(data.result);

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      setResult({
        success: false,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<ImportIcon />}
        onClick={() => setOpen(true)}
      >
        Import Emails
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Import Emails from Gmail</DialogTitle>
        <DialogContent>
          {!loading && !result && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Number of emails to import"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 20)}
                inputProps={{ min: 1, max: 100 }}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoArchive}
                    onChange={(e) => setAutoArchive(e.target.checked)}
                  />
                }
                label="Automatically archive emails in Gmail after import"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                This will import emails from your inbox, categorize them using
                AI, generate summaries, and optionally archive them in Gmail.
              </Typography>
            </Box>
          )}

          {loading && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                py: 4,
              }}
            >
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>
                Importing and analyzing emails...
              </Typography>
            </Box>
          )}

          {result && (
            <Box sx={{ pt: 2 }}>
              {result.success ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Successfully imported {result.imported} email(s)!
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Import failed or completed with errors
                </Alert>
              )}

              <Typography variant="body2">
                <strong>Imported:</strong> {result.imported}
              </Typography>
              <Typography variant="body2">
                <strong>Skipped:</strong> {result.skipped}
              </Typography>
              <Typography variant="body2">
                <strong>Failed:</strong> {result.failed}
              </Typography>

              {result.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="error">
                    <strong>Errors:</strong>
                  </Typography>
                  {result.errors.slice(0, 3).map((err, idx) => (
                    <Typography
                      key={idx}
                      variant="caption"
                      color="error"
                      display="block"
                    >
                      • {err}
                    </Typography>
                  ))}
                  {result.errors.length > 3 && (
                    <Typography variant="caption" color="error">
                      ... and {result.errors.length - 3} more
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!loading && !result && (
            <>
              <Button onClick={handleClose}>Cancel</Button>
              <Button variant="contained" onClick={handleImport}>
                Start Import
              </Button>
            </>
          )}
          {result && <Button onClick={handleClose}>Close</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}
