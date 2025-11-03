"use client";

import React from "react";
import {
  Box,
  Pagination,
  Select,
  MenuItem,
  Typography,
  FormControl,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
} from "@mui/icons-material";

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

export interface ReusablePaginationProps {
  config: PaginationConfig;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  limitOptions?: number[];
  showLimitSelector?: boolean;
  showPageInfo?: boolean;
  showFirstLastButtons?: boolean;
  limitLabel?: string;
  limitSelectorPosition?: "left" | "right";
  disabled?: boolean;
  size?: "small" | "medium" | "large";
}

// Reusable Pagination Component
export default function ReusablePagination({
  config,
  onPageChange,
  onLimitChange,
  limitOptions = [5, 10, 25, 50, 100],
  showLimitSelector = true,
  showPageInfo = true,
  showFirstLastButtons = true,
  limitLabel = "Show",
  limitSelectorPosition = "left",
  disabled = false,
  size = "medium",
}: ReusablePaginationProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const { page, limit, total } = config;
  const totalPages = Math.ceil(total / limit);

  // Calculate current range
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // Handle page changes
  const handleFirstPage = () => onPageChange(1);
  const handleLastPage = () => onPageChange(totalPages);
  const handlePrevPage = () => onPageChange(Math.max(1, page - 1));
  const handleNextPage = () => onPageChange(Math.min(totalPages, page + 1));
  const handlePageChange = (
    _event: React.ChangeEvent<unknown>,
    newPage: number
  ) => {
    onPageChange(newPage);
  };

  // Handle limit change
  const handleLimitChange = (event: { target: { value: unknown } }) => {
    const newLimit = parseInt(String(event.target.value), 10);
    onLimitChange(newLimit);
    // Reset to page 1 when changing limit
    if (page !== 1) {
      onPageChange(1);
    }
  };

  // Don't render if there's no data
  if (total === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        py: 2,
        px: { xs: 1, sm: 2 },
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      {/* Left section - Limit selector and page info */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          width: { xs: "100%", sm: "auto" },
          justifyContent: { xs: "space-between", sm: "flex-start" },
        }}
      >
        {limitSelectorPosition === "left" && showLimitSelector && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {limitLabel}:
            </Typography>
            <FormControl size="small" disabled={disabled}>
              <Select
                value={limit}
                onChange={handleLimitChange}
                sx={{
                  minWidth: 70,
                  "& .MuiSelect-select": {
                    py: 0.5,
                    fontSize: size === "small" ? "0.875rem" : "1rem",
                  },
                }}
                aria-label="Items per page"
              >
                {limitOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {showPageInfo && !isMobile && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: "nowrap" }}
              >
                items
              </Typography>
            )}
          </Box>
        )}
        {showPageInfo && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flexShrink: 0,
              display: { xs: "none", sm: "block" },
            }}
          >
            {startItem}-{endItem} of {total}
          </Typography>
        )}
      </Box>

      {/* Center section - Navigation */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          flex: { sm: 1 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {showFirstLastButtons && !isMobile && (
            <Tooltip title="First page">
              <span>
                <IconButton
                  onClick={handleFirstPage}
                  disabled={disabled || page === 1}
                  size={size}
                  aria-label="Go to first page"
                >
                  <FirstPageIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {isMobile ? (
            <>
              <Tooltip title="Previous page">
                <span>
                  <IconButton
                    onClick={handlePrevPage}
                    disabled={disabled || page === 1}
                    size={size}
                    aria-label="Go to previous page"
                  >
                    <NavigateBeforeIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
                {page} / {totalPages}
              </Typography>
              <Tooltip title="Next page">
                <span>
                  <IconButton
                    onClick={handleNextPage}
                    disabled={disabled || page === totalPages}
                    size={size}
                    aria-label="Go to next page"
                  >
                    <NavigateNextIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          ) : (
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              disabled={disabled}
              size={size}
              siblingCount={isTablet ? 0 : 1}
              boundaryCount={1}
              showFirstButton={!showFirstLastButtons}
              showLastButton={!showFirstLastButtons}
              color="primary"
              shape="rounded"
            />
          )}

          {showFirstLastButtons && !isMobile && (
            <Tooltip title="Last page">
              <span>
                <IconButton
                  onClick={handleLastPage}
                  disabled={disabled || page === totalPages}
                  size={size}
                  aria-label="Go to last page"
                >
                  <LastPageIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Right section - Optional right-aligned limit selector */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          width: { xs: "100%", sm: "auto" },
          justifyContent: { xs: "center", sm: "flex-end" },
        }}
      >
        {limitSelectorPosition === "right" && showLimitSelector && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {limitLabel}:
            </Typography>
            <FormControl size="small" disabled={disabled}>
              <Select
                value={limit}
                onChange={handleLimitChange}
                sx={{
                  minWidth: 70,
                  "& .MuiSelect-select": {
                    py: 0.5,
                    fontSize: size === "small" ? "0.875rem" : "1rem",
                  },
                }}
                aria-label="Items per page"
              >
                {limitOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {showPageInfo && !isMobile && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: "nowrap" }}
              >
                items
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
