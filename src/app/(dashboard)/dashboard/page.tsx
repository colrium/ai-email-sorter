"use client";

import { useSession } from "next-auth/react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import EmailIcon from "@mui/icons-material/Email";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { DashboardLayoutClient } from "@/components/common/DashboardLayout";
import ImportButton from "@/components/emails/ImportButton";
import EmailList from "@/components/emails/EmailList";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    categoriesCount: 0,
    emailsCount: 0,
    unreadCount: 0,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const categories = await response.json();
          const categoriesCount = categories.length;
          const emailsCount = categories.reduce(
            (sum: number, cat: { emailCount: number }) => sum + cat.emailCount,
            0
          );
          setStats({
            categoriesCount,
            emailsCount,
            unreadCount: 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
  }, [refreshKey]);

  return (
    <DashboardLayoutClient>
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Welcome back, {session?.user?.name?.split(" ")[0] || "there"}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your email categories and connected accounts
          </Typography>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Connected Gmail Accounts
            </Typography>
            {session?.user?.gmailAccounts &&
            session.user.gmailAccounts.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  mt: 1.5,
                }}
              >
                {[...session.user.gmailAccounts]
                  .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                  .map((account) => (
                    <Box
                      key={account.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <EmailIcon color="primary" sx={{ fontSize: 20 }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {account.email}
                        </Typography>
                      </Box>
                      {account.isPrimary && (
                        <Chip label="Primary" color="primary" size="small" />
                      )}
                    </Box>
                  ))}
              </Box>
            ) : (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                No Gmail accounts connected yet.
              </Alert>
            )}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              sx={{ mt: 1.5 }}
              onClick={() => router.push("/settings")}
            >
              Connect Another Account
            </Button>
          </CardContent>
        </Card>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: 3,
            mb: 3,
          }}
        >
          <Card
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <CategoryIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.categoriesCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Categories
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <EmailIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.emailsCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Emails Sorted
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <EmailIcon sx={{ fontSize: 40, opacity: 0.9 }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {stats.unreadCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Unread Emails
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Your Categories
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push("/categories/new")}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                New Category
              </Button>
            </Box>
            {stats.categoriesCount === 0 ? (
              <Alert severity="info">
                You haven&apos;t created any categories yet. Click &quot;New
                Category&quot; to get started!
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {stats.categoriesCount > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 3,
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 2,
                }}
              >
                <Typography variant="h6" fontWeight={600}>
                  Recent Emails
                </Typography>
                <ImportButton
                  onImportComplete={() => setRefreshKey((prev) => prev + 1)}
                />
              </Box>
              <EmailList
                key={refreshKey}
                onEmailClick={(emailId: string) =>
                  router.push(`/dashboard/emails/${emailId}`)
                }
              />
            </CardContent>
          </Card>
        )}
      </Box>
    </DashboardLayoutClient>
  );
}
