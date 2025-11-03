"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { DashboardLayoutClient } from "@/components/common/DashboardLayout";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
} from "@/lib/constants/colors";

export default function NewCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create category");
      }

      router.push("/categories");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create category"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayoutClient>
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mb: 3 }}
        >
          Back
        </Button>

        <Typography variant="h4" fontWeight={700} gutterBottom>
          Create New Category
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Define a category to organize your emails with AI
        </Typography>

        <Card sx={{ maxWidth: 600 }}>
          <CardContent>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: "flex", flexDirection: "column", gap: 3 }}
            >
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <TextField
                label="Category Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Newsletters, Work, Personal"
                required
                fullWidth
                disabled={loading}
              />

              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what emails belong in this category..."
                multiline
                rows={4}
                fullWidth
                disabled={loading}
                helperText="AI will use this description to categorize your emails"
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Color
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {CATEGORY_COLORS.map((c) => (
                    <Box
                      key={c}
                      component="button"
                      type="button"
                      onClick={() => setColor(c)}
                      disabled={loading}
                      aria-label={`Select color ${c}`}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        backgroundColor: c,
                        cursor: loading ? "not-allowed" : "pointer",
                        border: color === c ? "3px solid" : "2px solid",
                        borderColor: color === c ? "text.primary" : "divider",
                        transition: "all 0.2s",
                        opacity: loading ? 0.5 : 1,
                        "&:hover": {
                          transform: loading ? "none" : "scale(1.1)",
                        },
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: 2,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <SaveIcon />
                  }
                  disabled={loading || !name.trim()}
                >
                  {loading ? "Creating..." : "Create Category"}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayoutClient>
  );
}
