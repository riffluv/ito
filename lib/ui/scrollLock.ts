export type ScrollLockOptions = {
  lockRoot?: boolean;
};

let bodyLockCount = 0;
let rootLockCount = 0;
let prevBodyOverflow: string | null = null;
let prevRootOverflow: string | null = null;

const applyBodyLock = () => {
  if (typeof document === "undefined") return;
  if (!document.body) return;
  if (bodyLockCount === 1) {
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
};

const releaseBodyLock = () => {
  if (typeof document === "undefined") return;
  if (!document.body) return;
  if (bodyLockCount === 0) {
    document.body.style.overflow = prevBodyOverflow ?? "";
    prevBodyOverflow = null;
  }
};

const applyRootLock = () => {
  if (typeof document === "undefined") return;
  if (rootLockCount === 1) {
    prevRootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
};

const releaseRootLock = () => {
  if (typeof document === "undefined") return;
  if (rootLockCount === 0) {
    document.documentElement.style.overflow = prevRootOverflow ?? "";
    prevRootOverflow = null;
  }
};

export const lockScroll = (options: ScrollLockOptions = {}) => {
  if (typeof document === "undefined") {
    return () => {};
  }
  const lockRoot = Boolean(options.lockRoot);
  bodyLockCount += 1;
  applyBodyLock();

  if (lockRoot) {
    rootLockCount += 1;
    applyRootLock();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    if (lockRoot) {
      rootLockCount = Math.max(0, rootLockCount - 1);
      releaseRootLock();
    }

    bodyLockCount = Math.max(0, bodyLockCount - 1);
    releaseBodyLock();
  };
};

export const forceReleaseAllScrollLocks = () => {
  bodyLockCount = 0;
  rootLockCount = 0;

  if (typeof document !== "undefined") {
    if (document.body) {
      document.body.style.overflow = prevBodyOverflow ?? "";
    }
    document.documentElement.style.overflow = prevRootOverflow ?? "";
  }

  prevBodyOverflow = null;
  prevRootOverflow = null;
};
