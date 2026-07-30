import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { HardHat } from "lucide-react";
import { PartyPicker } from "../components/PartyPicker";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { useShopContext } from "../hooks/useShopContext";
import { createProject } from "../lib/api/projects";
import { getParty, type Party } from "../lib/api/parties";
import type { ProjectEstimateState } from "./EstimatorPage";

export function CreateProjectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const shop = useShopContext();
  const incoming = (location.state as ProjectEstimateState | null)?.projectEstimate ?? null;

  const [name, setName] = useState("");
  const [party, setParty] = useState<Party | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useQuery({
    queryKey: ["project-estimate-party", incoming?.partyId],
    queryFn: async () => {
      const p = await getParty(incoming!.partyId!);
      setParty(p);
      return p;
    },
    enabled: !!incoming?.partyId && !party,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        name,
        branchId: shop.branchId,
        partyId: party?.id ?? null,
        address: address || null,
        notes: notes || null,
        estimateSnapshot: incoming?.lines,
      }),
    onSuccess: (project) => navigate(`/projects/${project.id}`),
    onError: (err) => setSubmitError(axiosErrorMessage(err) ?? "Failed to create project"),
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        <HardHat size={18} className="text-gray-400" />
        New Project
      </h1>

      <div>
        <label className={labelClass}>Project / Site Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Ahmed Sb ka Ghar — DHA Phase 5"
        />
      </div>

      <div>
        <label className={labelClass}>Customer (optional)</label>
        <PartyPicker type="customer" placeholder="Search or add a customer…" selected={party} onSelect={setParty} onClear={() => setParty(null)} />
      </div>

      <div>
        <label className={labelClass}>Site Address (optional)</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>

      {incoming && incoming.lines.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Material plan (from the Estimator)</p>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {incoming.lines.map((l) => (
              <div key={l.productId} className="flex justify-between">
                <span>{l.productName}</span>
                <span>
                  {l.targetQuantity} {l.unitName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {submitError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {submitError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={!name || !shop.branchId || mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create Project"}
        </button>
      </div>
    </div>
  );
}
