"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Checkbox,
  IconButton,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Unsubscribe as UnsubscribeIcon,
  Email as EmailIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import UnsubscribeProgressDialog from "./UnsubscribeProgressDialog";
import ReusablePagination, {
  PaginationConfig,
} from "@/components/common/ReusablePagination";

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  aiSummary: string | null;
  category: {
    id: string;
    name: string;
    color: string | null;
  };
  hasAttachments: boolean;
  unsubscribeLink: string | null;
  unsubscribedAt?: string | null;
}

interface EmailListProps {
  categoryId?: string;
  categoryName?: string;
  onEmailClick: (emailId: string) => void;
}

export default function EmailList({
  categoryId,
  categoryName,
  onEmailClick,
}: EmailListProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paginationConfig, setPaginationConfig] = useState<PaginationConfig>({
    page: 1,
    limit: 20,
    total: 0,
  });

  // Fetch emails
  const fetchEmails = async (
    pageNum: number = 1,
    limitNum: number = 20,
    search?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limitNum.toString(),
      });

      if (categoryId) {
        params.append("categoryId", categoryId);
      }

      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/emails?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();
      setEmails(data.emails);
      setPaginationConfig({
        page: data.pagination.page,
        limit: data.pagination.limit,
        total: data.pagination.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  };

  // Load emails on mount and when filters change
  React.useEffect(() => {
    fetchEmails(1, paginationConfig.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // Handle search
  const handleSearch = () => {
    fetchEmails(1, paginationConfig.limit, searchQuery);
  };

  // Toggle email selection
  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmails(newSelection);
  };

  // Select all emails
  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map((e) => e.id)));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedEmails.size === 0) return;

    if (!confirm(`Delete ${selectedEmails.size} email(s)?`)) return;

    try {
      setLoading(true);
      const response = await fetch("/api/emails/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmails),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete emails");
      }

      const result = await response.json();

      // Clear selection
      setSelectedEmails(new Set());

      // Refresh email list
      await fetchEmails(
        paginationConfig.page,
        paginationConfig.limit,
        searchQuery
      );

      // Show success message
      alert(`Successfully queued deletion of ${result.emailCount} emails`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete emails");
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe state
  const [unsubscribeDialog, setUnsubscribeDialog] = useState(false);
  const [unsubscribeResults, setUnsubscribeResults] = useState<
    Array<{
      emailId: string;
      success: boolean | null;
      message: string;
    }>
  >([]);
  const [unsubscribeProgress, setUnsubscribeProgress] = useState(0);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  // Handle bulk unsubscribe
  const handleBulkUnsubscribe = async () => {
    if (selectedEmails.size === 0) return;

    const selectedEmailsList = emails.filter((e) => selectedEmails.has(e.id));

    if (
      !confirm(
        `Attempt to unsubscribe from ${selectedEmailsList.length} email(s)? This will use AI to navigate unsubscribe pages.`
      )
    )
      return;

    try {
      setIsUnsubscribing(true);
      setUnsubscribeDialog(true);
      setUnsubscribeResults([]);
      setUnsubscribeProgress(0);

      // Initialize results with pending status
      setUnsubscribeResults(
        selectedEmailsList.map((e) => ({
          emailId: e.id,
          from: e.from,
          subject: e.subject,
          success: null,
          message: "Processing...",
        }))
      );

      const response = await fetch("/api/emails/bulk-unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmails),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to unsubscribe");
      }

      const result = await response.json();

      // Update with actual results
      setUnsubscribeResults(result.results);
      setUnsubscribeProgress(100);

      // Clear selection
      setSelectedEmails(new Set());

      // Refresh email list
      await fetchEmails(
        paginationConfig.page,
        paginationConfig.limit,
        searchQuery
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
    } finally {
      setIsUnsubscribing(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {categoryName ? `${categoryName} Emails` : "All Emails"}
        </Typography>
        <IconButton
          onClick={() =>
            fetchEmails(
              paginationConfig.page,
              paginationConfig.limit,
              searchQuery
            )
          }
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Search and Actions */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
        </Stack>

        {selectedEmails.size > 0 && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Delete ({selectedEmails.size})
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<UnsubscribeIcon />}
              onClick={handleBulkUnsubscribe}
            >
              Unsubscribe ({selectedEmails.size})
            </Button>
          </Stack>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Email List */}
      {!loading && emails.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <EmailIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No emails found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {categoryName
              ? `No emails in ${categoryName} category`
              : "Import some emails to get started"}
          </Typography>
        </Box>
      )}

      {!loading && emails.length > 0 && (
        <>
          {/* Select All */}
          <Box sx={{ mb: 1 }}>
            <Checkbox
              checked={selectedEmails.size === emails.length}
              indeterminate={
                selectedEmails.size > 0 && selectedEmails.size < emails.length
              }
              onChange={toggleSelectAll}
            />
            <Typography variant="body2" component="span" color="text.secondary">
              Select all ({emails.length})
            </Typography>
          </Box>

          {/* Email Cards */}
          <Stack spacing={1.5}>
            {emails.map((email) => (
              <Card
                key={email.id}
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    boxShadow: 3,
                  },
                }}
              >
                <CardContent
                  sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                    <Checkbox
                      checked={selectedEmails.has(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0.5, mr: 1 }}
                    />
                    <Box
                      sx={{ flexGrow: 1, minWidth: 0 }}
                      onClick={() => onEmailClick(email.id)}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          mb: 0.75,
                          gap: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flexGrow: 1,
                          }}
                        >
                          {email.subject || "(No Subject)"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(email.date), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        From: {email.from}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          mb: 0.75,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {email.aiSummary || email.snippet}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={0.75}
                        flexWrap="wrap"
                        gap={0.5}
                      >
                        <Chip
                          label={email.category.name}
                          size="small"
                          sx={{
                            bgcolor: email.category.color || undefined,
                            color: "white",
                            height: 24,
                          }}
                        />
                        {email.hasAttachments && (
                          <Chip
                            label="Has attachments"
                            size="small"
                            sx={{ height: 24 }}
                          />
                        )}
                        {email.unsubscribeLink && (
                          <Chip
                            label="Can unsubscribe"
                            size="small"
                            color="warning"
                            sx={{ height: 24 }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {/* Reusable Pagination */}
          <ReusablePagination
            config={paginationConfig}
            onPageChange={(newPage) =>
              fetchEmails(newPage, paginationConfig.limit, searchQuery)
            }
            onLimitChange={(newLimit) => {
              fetchEmails(1, newLimit, searchQuery);
            }}
            limitOptions={[5, 10, 20, 25, 50, 100]}
            showFirstLastButtons={true}
            showPageInfo={true}
            disabled={loading}
          />
        </>
      )}

      {/* Unsubscribe Progress Dialog */}
      <UnsubscribeProgressDialog
        open={unsubscribeDialog}
        onClose={() => setUnsubscribeDialog(false)}
        results={unsubscribeResults}
        isProcessing={isUnsubscribing}
        progress={unsubscribeProgress}
      />
    </Box>
  );
}
