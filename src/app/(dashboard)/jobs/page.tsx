/**
 * Job Monitoring Dashboard
 * View queue metrics, active jobs, and failed jobs
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Stack,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";

interface QueueMetrics {
  emailImport: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  scheduledImport: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  emailDelete: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  gmailWatch: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

interface JobsResponse {
  success: boolean;
  metrics: QueueMetrics;
  timestamp: string;
}

export default function JobsPage() {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/jobs");
      if (!response.ok) {
        throw new Error("Failed to fetch job metrics");
      }

      const data: JobsResponse = await response.json();
      setMetrics(data.metrics);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const QueueCard = ({
    title,
    counts,
    description,
  }: {
    title: string;
    counts: QueueMetrics["emailImport"];
    description: string;
  }) => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ flex: "1 1 150px", textAlign: "center" }}>
            <Stack alignItems="center" spacing={1}>
              <HourglassIcon color="action" />
              <Typography variant="h4">{counts.waiting}</Typography>
              <Typography variant="caption" color="text.secondary">
                Waiting
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ flex: "1 1 150px", textAlign: "center" }}>
            <Stack alignItems="center" spacing={1}>
              <PlayArrowIcon color="primary" />
              <Typography variant="h4" color="primary">
                {counts.active}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ flex: "1 1 150px", textAlign: "center" }}>
            <Stack alignItems="center" spacing={1}>
              <CheckCircleIcon color="success" />
              <Typography variant="h4" color="success.main">
                {counts.completed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ flex: "1 1 150px", textAlign: "center" }}>
            <Stack alignItems="center" spacing={1}>
              <ErrorIcon color="error" />
              <Typography variant="h4" color="error.main">
                {counts.failed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Failed
              </Typography>
            </Stack>
          </Box>
        </Box>

        {counts.delayed > 0 && (
          <Box sx={{ mt: 2 }}>
            <Chip
              label={`${counts.delayed} delayed`}
              size="small"
              color="warning"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Job Queue Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor background job processing and queue metrics
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchMetrics}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {lastUpdate && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 2, display: "block" }}
        >
          Last updated: {lastUpdate} (auto-refreshes every 10 seconds)
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && !metrics && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {metrics && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          <QueueCard
            title="Email Import Queue"
            counts={metrics.emailImport}
            description="Imports individual emails from Gmail, categorizes, and summarizes them"
          />

          <QueueCard
            title="Scheduled Import Queue"
            counts={metrics.scheduledImport}
            description="Runs every 5 minutes to check all accounts for new emails"
          />

          <QueueCard
            title="Email Delete Queue"
            counts={metrics.emailDelete}
            description="Handles bulk deletion of emails with category count updates"
          />

          <QueueCard
            title="Gmail Watch Queue"
            counts={metrics.gmailWatch}
            description="Renews Gmail push notification subscriptions every 6 days"
          />
        </Box>
      )}

      {/* System Status */}
      {metrics && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            System Status
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Active Jobs
              </Typography>
              <Typography variant="h5">
                {metrics.emailImport.active +
                  metrics.scheduledImport.active +
                  metrics.emailDelete.active +
                  metrics.gmailWatch.active}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Waiting Jobs
              </Typography>
              <Typography variant="h5">
                {metrics.emailImport.waiting +
                  metrics.scheduledImport.waiting +
                  metrics.emailDelete.waiting +
                  metrics.gmailWatch.waiting}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Completed (24h)
              </Typography>
              <Typography variant="h5" color="success.main">
                {metrics.emailImport.completed +
                  metrics.scheduledImport.completed +
                  metrics.emailDelete.completed +
                  metrics.gmailWatch.completed}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Failed (7d)
              </Typography>
              <Typography variant="h5" color="error.main">
                {metrics.emailImport.failed +
                  metrics.scheduledImport.failed +
                  metrics.emailDelete.failed +
                  metrics.gmailWatch.failed}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Background Worker Status
        </Typography>
        <Typography variant="body2">
          Make sure the background worker is running with{" "}
          <code>yarn worker</code>. If jobs are stuck in &ldquo;waiting&rdquo;
          state, check that Redis is running and the worker process is active.
        </Typography>
      </Alert>
    </Container>
  );
}
