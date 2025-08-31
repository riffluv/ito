import "@testing-library/jest-dom";

// Add structuredClone polyfill for Node.js environments
if (!global.structuredClone) {
  global.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

// Setup for Firebase testing - prevent Firebase app conflicts
beforeEach(() => {
  // Clear any Firebase apps from previous tests
  jest.clearAllMocks();
});
