// Basic smoke tests for Cloud Functions exports

describe("Cloud Functions exports", () => {
  test("weeklyReportToTeams is exported", () => {
    // Mock firebase modules before requiring
    jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
    jest.mock("firebase-admin/firestore", () => ({
      getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ get: jest.fn() })),
          where: jest.fn(() => ({ get: jest.fn() })),
          get: jest.fn(),
        })),
      })),
    }));
    jest.mock("firebase-functions/v2/scheduler", () => ({
      onSchedule: jest.fn((opts, handler) => handler),
    }));
    jest.mock("firebase-functions/v2/firestore", () => ({
      onDocumentUpdated: jest.fn((opts, handler) => handler),
    }));

    const fns = require("../index");
    expect(fns.weeklyReportToTeams).toBeDefined();
    expect(fns.salesAlertOnGatePass).toBeDefined();
  });
});
