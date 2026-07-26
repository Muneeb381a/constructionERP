import { z } from "zod";

export const dashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
