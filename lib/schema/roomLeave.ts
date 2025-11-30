import { z } from "zod";

export const leaveRoomSchema = z.object({
  uid: z.string().min(1),
  token: z.string().min(1),
  displayName: z.string().min(1).optional().nullable(),
});

export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
