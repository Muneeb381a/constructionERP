import { app } from "./server.js";
import { env } from "./config/env.js";
import { scheduleReconciliationJob } from "./jobs/reconciliation.job.js";

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

scheduleReconciliationJob();
