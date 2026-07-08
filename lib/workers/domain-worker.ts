import { pollSslProvisioning, reconcileDomains } from "@/lib/domain-service";
import type { JobPayloads } from "@/lib/job-queue";

export async function processDomainProvisionSslJob(payload: JobPayloads["domain-provision-ssl"]): Promise<void> {
  await pollSslProvisioning(payload.userId, payload.attempt);
}

export async function processDomainReconcileJob(): Promise<void> {
  const result = await reconcileDomains();
  console.log(
    `[DomainWorker] reconcile complete — reverified ${result.reverified}, drifted ${result.drifted}, expired ${result.expired}`
  );
}
