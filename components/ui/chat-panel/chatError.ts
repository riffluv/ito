type ZodLikeError = { errors?: Array<{ message?: string }> };

export function getChatErrorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const maybeZod = error as ZodLikeError;
    if (Array.isArray(maybeZod.errors) && maybeZod.errors[0]?.message) {
      return maybeZod.errors[0]?.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}

