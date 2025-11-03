import { jest } from "@jest/globals";
import { OAuth2Client } from "google-auth-library";
import { gmail_v1 } from "googleapis";

// Mock the dependencies
jest.mock("@/lib/db/prisma", () => ({
  __esModule: true,
  default: {
    gmailAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        getProfile: jest.fn(),
      },
    }),
  },
}));

jest.mock("@/lib/utils/encryption", () => ({
  decrypt: jest.fn((text: string | null) =>
    text ? text.replace("encrypted-", "") : null
  ),
  encrypt: jest.fn((text: string) => `encrypted-${text}`),
}));

jest.mock("@/lib/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

interface PrismaClient {
  gmailAccount: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

describe("Gmail Client", () => {
  let createGmailClient: (accountId: string) => Promise<OAuth2Client | null>;
  let getGmailApi: (accountId: string) => Promise<gmail_v1.Gmail | null>;
  let testGmailConnection: (accountId: string) => Promise<boolean>;
  let prisma: PrismaClient;
  let decrypt: (text: string | null) => string | null;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import the module after mocks are set up
    const gmailClientModule = await import("@/lib/gmail/client");
    createGmailClient = gmailClientModule.createGmailClient;
    getGmailApi = gmailClientModule.getGmailApi;
    testGmailConnection = gmailClientModule.testGmailConnection;

    const prismaModule = await import("@/lib/db/prisma");
    prisma = prismaModule.default;

    const encryptionModule = await import("@/lib/utils/encryption");
    decrypt = encryptionModule.decrypt as (
      text: string | null
    ) => string | null;
  });

  describe("createGmailClient", () => {
    it("should create OAuth2 client with decrypted tokens", async () => {
      const mockAccount = {
        id: "account-123",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000),
      };

      (
        prisma.gmailAccount.findUnique as unknown as jest.Mock
      ).mockResolvedValue(mockAccount);

      const client = await createGmailClient("account-123");

      expect(client).toBeDefined();
      expect(prisma.gmailAccount.findUnique).toHaveBeenCalledWith({
        where: { id: "account-123" },
      });
      expect(decrypt).toHaveBeenCalledWith("encrypted-access-token");
      expect(decrypt).toHaveBeenCalledWith("encrypted-refresh-token");
    });

    it("should throw error if account not found", async () => {
      (
        prisma.gmailAccount.findUnique as unknown as jest.Mock
      ).mockResolvedValue(null);

      await expect(createGmailClient("invalid-id")).rejects.toThrow(
        "Gmail account not found"
      );
    });

    it("should throw error if no access token", async () => {
      const mockAccount = {
        id: "account-123",
        accessToken: null,
        refreshToken: "encrypted-refresh-token",
      };

      (
        prisma.gmailAccount.findUnique as unknown as jest.Mock
      ).mockResolvedValue(mockAccount);

      await expect(createGmailClient("account-123")).rejects.toThrow(
        "No access token found for account"
      );
    });
  });

  describe("getGmailApi", () => {
    it("should return Gmail API instance", async () => {
      const mockAccount = {
        id: "account-123",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000),
      };

      (
        prisma.gmailAccount.findUnique as unknown as jest.Mock
      ).mockResolvedValue(mockAccount);

      const gmailApi = await getGmailApi("account-123");

      expect(gmailApi).toBeDefined();
      expect(gmailApi.users).toBeDefined();
    });
  });

  describe("testGmailConnection", () => {
    it("should return true for successful connection", async () => {
      const mockAccount = {
        id: "account-123",
        email: "test@gmail.com",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000),
      };

      prisma.gmailAccount.findUnique.mockResolvedValue(mockAccount);

      const { google } = await import("googleapis");
      const mockGmail = google.gmail();
      (mockGmail.users.getProfile as jest.Mock).mockResolvedValue({
        data: { emailAddress: "test@gmail.com" },
      });

      const result = await testGmailConnection("account-123");

      expect(result).toBe(true);
    });

    it("should return false for failed connection", async () => {
      const mockAccount = {
        id: "account-123",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000),
      };

      prisma.gmailAccount.findUnique.mockResolvedValue(mockAccount);

      const { google } = await import("googleapis");
      const mockGmail = google.gmail();
      (mockGmail.users.getProfile as jest.Mock).mockRejectedValue(
        new Error("Connection failed")
      );

      const result = await testGmailConnection("account-123");

      expect(result).toBe(false);
    });
  });
});
