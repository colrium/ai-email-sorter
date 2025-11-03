"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import UnsubscribeIcon from "@mui/icons-material/Unsubscribe";
import { formatDistanceToNow } from "date-fns";
import { DashboardLayoutClient } from "@/components/common/DashboardLayout";

interface Email {
  id: string;
  gmailMessageId: string;
  subject: string;
  from: string;
  to: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  hasAttachments: boolean;
  unsubscribeLink: string | null;
  aiSummary: string | null;
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
  gmailAccount: {
    email: string;
  };
}

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailId = params.id as string;

  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const response = await fetch(`/api/emails/${emailId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Email not found");
          } else if (response.status === 401) {
            setError("Unauthorized");
          } else {
            setError("Failed to load email");
          }
          return;
        }
        const data = await response.json();
        setEmail(data);
      } catch {
        setError("Failed to load email");
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [emailId]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this email?")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/emails/${emailId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete email");
      }

      router.push("/dashboard");
    } catch {
      alert("Failed to delete email. Please try again.");
      setDeleting(false);
    }
  };

  const handleUnsubscribe = () => {
    if (email?.unsubscribeLink) {
      window.open(email.unsubscribeLink, "_blank");
    }
  };

  if (loading) {
    return (
      <DashboardLayoutClient>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "60vh",
          }}
        >
          <CircularProgress />
        </Box>
      </DashboardLayoutClient>
    );
  }

  if (error || !email) {
    return (
      <DashboardLayoutClient>
        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error || "Email not found"}
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </Box>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient>
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/dashboard")}
          >
            Back
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {email.unsubscribeLink && (
            <Tooltip title="Unsubscribe">
              <IconButton
                onClick={handleUnsubscribe}
                color="primary"
                disabled={deleting}
              >
                <UnsubscribeIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete Email">
            <IconButton
              onClick={handleDelete}
              color="error"
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={24} /> : <DeleteIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              {email.category && (
                <Chip
                  label={email.category.name}
                  sx={{
                    backgroundColor: email.category.color,
                    color: "white",
                  }}
                  size="small"
                />
              )}
              {email.hasAttachments && (
                <Chip
                  icon={<AttachFileIcon />}
                  label="Attachments"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            <Typography variant="h5" fontWeight={600} gutterBottom>
              {email.subject}
            </Typography>

            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  From:
                </Typography>
                <Typography variant="body2">{email.from}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  To:
                </Typography>
                <Typography variant="body2">{email.to}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  Date:
                </Typography>
                <Typography variant="body2">
                  {email.receivedAt
                    ? `${new Date(
                        email.receivedAt
                      ).toLocaleString()} (${formatDistanceToNow(
                        new Date(email.receivedAt)
                      )} ago)`
                    : "Unknown"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  Account:
                </Typography>
                <Typography variant="body2">
                  {email.gmailAccount.email}
                </Typography>
              </Box>
            </Box>

            {email.aiSummary && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: "primary.light",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "primary.main",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="primary.main"
                    fontWeight={600}
                    gutterBottom
                  >
                    AI Summary
                  </Typography>
                  <Typography variant="body2">{email.aiSummary}</Typography>
                </Box>
              </>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography
              variant="subtitle2"
              color="text.secondary"
              fontWeight={600}
              gutterBottom
            >
              Email Content
            </Typography>
            {email.bodyHtml ? (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "grey.50",
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  maxHeight: "600px",
                  overflow: "auto",
                  "& img": {
                    maxWidth: "100%",
                    height: "auto",
                  },
                  "& a": {
                    color: "primary.main",
                  },
                }}
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "grey.50",
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  maxHeight: "600px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                }}
              >
                {email.bodyText || "No content available"}
              </Box>
            )}

            {email.gmailMessageId && (
              <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  onClick={() =>
                    window.open(
                      `https://mail.google.com/mail/u/${email.gmailAccount.email}/#all/${email.gmailMessageId}`,
                      "_blank"
                    )
                  }
                >
                  View in Gmail
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </DashboardLayoutClient>
  );
}
