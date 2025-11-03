import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "@/app/(dashboard)/settings/page";

// Mock next-auth
jest.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    },
    status: "authenticated",
  })),
}));

// Mock DashboardLayout
jest.mock("@/components/common/DashboardLayout", () => ({
  DashboardLayoutClient: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockAccounts = [
  {
    id: "account-1",
    email: "test1@gmail.com",
    isActive: true,
    syncStatus: "active",
    lastSyncAt: "2025-11-03T10:00:00Z",
    emailCount: 150,
  },
  {
    id: "account-2",
    email: "test2@gmail.com",
    isActive: false,
    syncStatus: "idle",
    lastSyncAt: null,
    emailCount: 0,
  },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear URL parameters
    window.history.replaceState({}, "", "/settings");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders settings page with title", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    render(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your account and Gmail connections")
    ).toBeInTheDocument();
  });

  it("displays loading state while fetching accounts", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ ok: true, json: async () => ({ accounts: [] }) }),
            1000
          )
        )
    );

    render(<SettingsPage />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("fetches and displays connected accounts", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
      expect(screen.getByText("test2@gmail.com")).toBeInTheDocument();
    });

    // Check account details
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText("150 emails")).toBeInTheDocument();
  });

  it("displays info message when no accounts are connected", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No Gmail accounts connected/i)
      ).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load accounts/i)).toBeInTheDocument();
    });
  });

  it("displays success message from URL parameter", async () => {
    window.history.replaceState({}, "", "/settings?success=account_connected");

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Gmail account connected successfully!")
      ).toBeInTheDocument();
    });
  });

  it("displays error message from URL parameter", async () => {
    window.history.replaceState({}, "", "/settings?error=invalid_code");

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to connect account: invalid_code/i)
      ).toBeInTheDocument();
    });
  });

  it("initiates OAuth flow when Connect Account is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    // Mock window.location.href setter
    const hrefSpy = jest.fn();
    Object.defineProperty(window, "location", {
      value: { href: hrefSpy },
      writable: true,
    });

    // Mock environment variable
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Connect Account")).toBeInTheDocument();
    });

    const connectButton = screen.getByText("Connect Account");
    fireEvent.click(connectButton);

    // Check if redirect URL was set
    await waitFor(() => {
      expect(hrefSpy).toHaveBeenCalled();
    });
  });

  it("handles account disconnect with confirmation", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: [mockAccounts[0]] }),
      });

    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test2@gmail.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId("DeleteIcon");
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        "Are you sure you want to disconnect this account?"
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/accounts/account-2",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("cancels account disconnect when user cancels confirmation", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    window.confirm = jest.fn(() => false);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId("DeleteIcon");
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    // Should not make DELETE request
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial fetch
  });

  it("handles refresh account action", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
    });

    const refreshButtons = screen.getAllByTestId("RefreshIcon");
    fireEvent.click(refreshButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/accounts/account-1/refresh",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("displays error when disconnect fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      })
      .mockRejectedValueOnce(new Error("Failed to disconnect account"));

    window.confirm = jest.fn(() => true);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId("DeleteIcon");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Failed to disconnect/i)).toBeInTheDocument();
    });
  });

  it("displays error when refresh fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accounts: mockAccounts }),
      })
      .mockRejectedValueOnce(new Error("Failed to refresh account"));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
    });

    const refreshButtons = screen.getAllByTestId("RefreshIcon");
    fireEvent.click(refreshButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Failed to refresh/i)).toBeInTheDocument();
    });
  });

  it("closes error alert when close button is clicked", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load accounts/i)).toBeInTheDocument();
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByText(/Failed to load accounts/i)
      ).not.toBeInTheDocument();
    });
  });

  it("does not have invalid HTML nesting (hydration error)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("test1@gmail.com")).toBeInTheDocument();
    });

    // Check that Chips are not nested inside <p> tags
    const chips = container.querySelectorAll(".MuiChip-root");
    chips.forEach((chip) => {
      let parent = chip.parentElement;
      while (parent) {
        expect(parent.tagName).not.toBe("P");
        parent = parent.parentElement;
      }
    });
  });
});
