"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
  Alert,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import { useState, Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Sign in error:", error);
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 480,
          }}
        >
          <CardContent
            sx={{
              p: { xs: 3, sm: 4 },
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            {/* Logo */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <EmailIcon sx={{ fontSize: 48, color: "primary.main" }} />
              <Typography
                variant="h4"
                component="h1"
                fontWeight={700}
                sx={{
                  background:
                    "linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI Email Sorter
              </Typography>
            </Box>

            {/* Description */}
            <Typography
              variant="body1"
              color="text.secondary"
              align="center"
              sx={{ mb: 2 }}
            >
              Automatically sort, categorize, and manage your emails with
              AI-powered intelligence
            </Typography>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {error === "OAuthSignin"
                  ? "Error connecting to Google. Please try again."
                  : error === "OAuthCallback"
                  ? "Error during authentication. Please try again."
                  : error === "OAuthAccountNotLinked"
                  ? "This email is already linked to another account."
                  : "An error occurred during sign in. Please try again."}
              </Alert>
            )}

            {/* Features List */}
            <Box sx={{ width: "100%", textAlign: "left" }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                ✓ AI-powered email categorization
              </Typography>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                ✓ Automatic email summaries
              </Typography>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                ✓ Bulk actions and unsubscribe
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">
                ✓ Multiple Gmail account support
              </Typography>
            </Box>

            {/* Sign In Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSignIn}
              disabled={loading}
              startIcon={<GoogleIcon />}
              sx={{
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "none",
                boxShadow: 2,
                "&:hover": {
                  boxShadow: 4,
                },
              }}
            >
              {loading ? "Signing in..." : "Sign in with Google"}
            </Button>

            {/* Privacy Notice */}
            <Typography
              variant="caption"
              color="text.secondary"
              align="center"
              sx={{ mt: 2 }}
            >
              By signing in, you agree to grant access to your Gmail account. We
              only read emails to categorize and summarize them. Your data is
              encrypted and secure.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
