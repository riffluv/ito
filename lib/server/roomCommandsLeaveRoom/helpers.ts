export function isUidMismatch(params: { uidFromToken: string; uidFromPayload: string }): boolean {
  return params.uidFromToken !== params.uidFromPayload;
}

