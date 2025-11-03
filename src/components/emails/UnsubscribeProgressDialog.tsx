/**
 * Unsubscribe Progress Dialog
 * Shows real-time progress for bulk unsubscribe operations
 */

"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import { CheckCircle, Error, HourglassEmpty, Email } from "@mui/icons-material";

interface UnsubscribeResult {
  emailId: string;
  from?: string;
  subject?: string;
  success: boolean | null;
  message: string;
}

interface UnsubscribeProgressDialogProps {
  open: boolean;
  onClose: () => void;
  results: UnsubscribeResult[];
  isProcessing: boolean;
  progress: number;
}

export default function UnsubscribeProgressDialog({
  open,
  onClose,
  results,
  isProcessing,
  progress,
}: UnsubscribeProgressDialogProps) {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => r.success === false).length;
  const pending = Math.max(0, results.length - successful - failed);

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Unsubscribe Progress
        <Typography variant="body2" color="text.secondary">
          Processing {results.length} email{results.length !== 1 ? "s" : ""}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Progress Bar */}
        {isProcessing && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              {progress.toFixed(0)}% complete
            </Typography>
          </Box>
        )}

        {/* Summary Stats */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <Chip
            icon={<CheckCircle />}
            label={`${successful} successful`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<Error />}
            label={`${failed} failed`}
            color="error"
            variant="outlined"
          />
          {pending > 0 && (
            <Chip
              icon={<HourglassEmpty />}
              label={`${pending} pending`}
              color="default"
              variant="outlined"
            />
          )}
        </Box>

        {/* Results List */}
        <List sx={{ maxHeight: 400, overflow: "auto" }}>
          {results.map((result) => (
            <ListItem
              key={result.emailId}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemIcon>
                {result.success ? (
                  <CheckCircle color="success" />
                ) : result.success === false ? (
                  <Error color="error" />
                ) : (
                  <HourglassEmpty color="disabled" />
                )}
              </ListItemIcon>

              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Email fontSize="small" />
                    <Typography variant="body2" noWrap>
                      {result.from || result.emailId}
                    </Typography>
                  </Box>
                }
                secondary={
                  <>
                    {result.subject && (
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.subject}
                      </Typography>
                    )}
                    {result.message && (
                      <Typography
                        variant="caption"
                        color={result.success ? "success.main" : "error.main"}
                      >
                        {result.message}
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isProcessing} variant="contained">
          {isProcessing ? "Processing..." : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
