/* eslint-disable no-console */
describe("log", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_VERCEL = process.env.VERCEL;
  const ORIGINAL_LOG_LEVEL = process.env.LOG_LEVEL;
  const ORIGINAL_PUBLIC_LOG_LEVEL = process.env.NEXT_PUBLIC_LOG_LEVEL;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    process.env.VERCEL = ORIGINAL_VERCEL;
    process.env.LOG_LEVEL = ORIGINAL_LOG_LEVEL;
    process.env.NEXT_PUBLIC_LOG_LEVEL = ORIGINAL_PUBLIC_LOG_LEVEL;
    jest.restoreAllMocks();
  });

  test("respects NEXT_PUBLIC_LOG_LEVEL on the client", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_LOG_LEVEL = "warn";
    jest.resetModules();

    const { logInfo, logWarn } = (await import("@/lib/utils/log")) as typeof import("@/lib/utils/log");

    logInfo("scope", "info");
    logWarn("scope", "warn");

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("[scope] warn");
  });

  test("default client level is warn in production when NEXT_PUBLIC_LOG_LEVEL is not set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_LOG_LEVEL;
    jest.resetModules();

    const { logInfo, logWarn } = (await import("@/lib/utils/log")) as typeof import("@/lib/utils/log");
    logInfo("scope", "info");
    logWarn("scope", "warn");

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("[scope] warn");
  });

  test("logs include payload when provided", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_LOG_LEVEL = "debug";
    jest.resetModules();

    const { logDebug } = (await import("@/lib/utils/log")) as typeof import("@/lib/utils/log");
    logDebug("scope", "msg", { a: 1 });
    expect(console.debug).toHaveBeenCalledWith("[scope] msg", { a: 1 });
  });
});
