"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DashboardLayoutClient } from "@/components/common/DashboardLayout";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  emailCount: number;
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load categories"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete category");

      setCategories(categories.filter((c) => c.id !== categoryToDelete.id));
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete category"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayoutClient>
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Categories
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your email categories
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push("/categories/new")}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            New Category
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent>
              <Alert severity="info">
                No categories yet. Click &quot;New Category&quot; to create your
                first one!
              </Alert>
            </CardContent>
          </Card>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gap: 3,
            }}
          >
            {categories.map((category) => (
              <Card
                key={category.id}
                sx={{
                  position: "relative",
                  "&:hover": { boxShadow: 4 },
                  transition: "box-shadow 0.2s",
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: category.color,
                        }}
                      />
                      <Typography variant="h6" fontWeight={600}>
                        {category.name}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() =>
                          router.push(`/categories/${category.id}/edit`)
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(category)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {category.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, minHeight: 40 }}
                    >
                      {category.description}
                    </Typography>
                  )}

                  <Chip
                    label={`${category.emailCount} emails`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleting && setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Category?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete &quot;{categoryToDelete?.name}
              &quot;? This action cannot be undone. Emails in this category will
              become uncategorized.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={24} /> : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayoutClient>
  );
}
