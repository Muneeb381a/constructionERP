import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Download, HardHat, MessageCircle, PackagePlus, X } from "lucide-react";
import { ProductPicker } from "../components/ProductPicker";
import { PartyPicker } from "../components/PartyPicker";
import { inputClass, labelClass } from "../lib/formStyles";
import { formatCurrency } from "../lib/format";
import { axiosErrorMessage } from "../lib/errors";
import { buildMaterialEstimateMessage, buildWhatsAppLink, buildWhatsAppShareLink } from "../lib/whatsapp";
import { downloadEstimateSlip } from "../lib/api/estimator";
import { listUnits, type Unit } from "../lib/api/units";
import type { Product } from "../lib/api/products";
import type { Party } from "../lib/api/parties";
import {
  estimateBrickWall,
  estimatePcc,
  estimatePlaster,
  estimateRccSlab,
} from "../lib/materialEstimator";

export type EstimateQuotationState = {
  estimate: {
    items: { productId: string; unitId: number; quantity: number }[];
  };
};

export type ProjectEstimateState = {
  projectEstimate: {
    partyId: string | null;
    lines: { productId: string; productName: string; targetQuantity: number; unitName: string }[];
  };
};

type Tab = "wall" | "slab" | "pcc" | "plaster";

const tabs: { key: Tab; label: string }[] = [
  { key: "wall", label: "Brick Wall" },
  { key: "slab", label: "RCC Slab / Chhat" },
  { key: "pcc", label: "Foundation (PCC)" },
  { key: "plaster", label: "Plaster" },
];

type MaterialLine = { key: string; label: string; qty: number; unit: string; hint: string };

function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className={inputClass}
      />
    </div>
  );
}

function WallForm({ customer }: { customer: Party | null }) {
  const [lengthFt, setLengthFt] = useState(10);
  const [heightFt, setHeightFt] = useState(10);
  const [thicknessIn, setThicknessIn] = useState(9);
  const [mortarSandParts, setMortarSandParts] = useState(6);

  const result = estimateBrickWall({ lengthFt, heightFt, thicknessIn, mortarSandParts });
  const lines: MaterialLine[] = [
    { key: "bricks", label: "Bricks", qty: result.bricks, unit: "pcs", hint: "brick" },
    { key: "cement", label: "Cement", qty: result.cementBags, unit: "bags", hint: "cement" },
    { key: "sand", label: "Sand", qty: result.sandCft, unit: "cft", hint: "sand" },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
        <NumberField label="Height (ft)" value={heightFt} onChange={setHeightFt} />
        <div>
          <label className={labelClass}>Thickness</label>
          <select value={thicknessIn} onChange={(e) => setThicknessIn(Number(e.target.value))} className={inputClass}>
            <option value={4.5}>4.5" (half brick)</option>
            <option value={9}>9" (one brick)</option>
            <option value={13.5}>13.5" (one and a half brick)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Mortar Ratio</label>
          <select value={mortarSandParts} onChange={(e) => setMortarSandParts(Number(e.target.value))} className={inputClass}>
            <option value={4}>1:4 (cement:sand)</option>
            <option value={6}>1:6 (cement:sand)</option>
          </select>
        </div>
      </div>
      <ResultCard lines={lines} note={`Wall volume: ${result.wallVolumeCft} cft`} />
      <AssignSection
        lines={lines}
        title="Brick Wall"
        dimensionsNote={`${lengthFt}ft x ${heightFt}ft, ${thicknessIn}" thick`}
        customer={customer}
      />
    </>
  );
}

function SlabForm({ customer }: { customer: Party | null }) {
  const [lengthFt, setLengthFt] = useState(20);
  const [widthFt, setWidthFt] = useState(15);
  const [thicknessIn, setThicknessIn] = useState(5);
  const [ratio, setRatio] = useState("1:2:4");
  const [steelKgPerSqft, setSteelKgPerSqft] = useState(1.0);

  const [cementParts, sandParts, aggregateParts] = ratio.split(":").map(Number);
  const result = estimateRccSlab({ lengthFt, widthFt, thicknessIn, cementParts, sandParts, aggregateParts, steelKgPerSqft });
  const lines: MaterialLine[] = [
    { key: "cement", label: "Cement", qty: result.cementBags, unit: "bags", hint: "cement" },
    { key: "sand", label: "Sand", qty: result.sandCft, unit: "cft", hint: "sand" },
    { key: "aggregate", label: "Aggregate / Bajri", qty: result.aggregateCft, unit: "cft", hint: "bajri" },
    { key: "steel", label: "Steel / Sariya", qty: result.steelKg, unit: "kg", hint: "steel" },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
        <NumberField label="Width (ft)" value={widthFt} onChange={setWidthFt} />
        <NumberField label="Thickness (in)" value={thicknessIn} onChange={setThicknessIn} />
        <div>
          <label className={labelClass}>Mix Ratio</label>
          <select value={ratio} onChange={(e) => setRatio(e.target.value)} className={inputClass}>
            <option value="1:1.5:3">1:1.5:3 (high strength)</option>
            <option value="1:2:4">1:2:4 (standard slab)</option>
            <option value="1:3:6">1:3:6 (lean)</option>
          </select>
        </div>
      </div>
      <div className="mt-3 max-w-xs">
        <NumberField label="Steel (kg per sqft)" value={steelKgPerSqft} onChange={setSteelKgPerSqft} step={0.05} />
      </div>
      <ResultCard lines={lines} note={`Area: ${result.areaSqft} sqft · Volume: ${result.volumeCft} cft`} />
      <AssignSection
        lines={lines}
        title="RCC Slab / Chhat"
        dimensionsNote={`${lengthFt}ft x ${widthFt}ft, ${thicknessIn}" thick`}
        customer={customer}
      />
    </>
  );
}

function PccForm({ customer }: { customer: Party | null }) {
  const [lengthFt, setLengthFt] = useState(20);
  const [widthFt, setWidthFt] = useState(2);
  const [thicknessIn, setThicknessIn] = useState(4);
  const [ratio, setRatio] = useState("1:4:8");

  const [cementParts, sandParts, aggregateParts] = ratio.split(":").map(Number);
  const result = estimatePcc({ lengthFt, widthFt, thicknessIn, cementParts, sandParts, aggregateParts });
  const lines: MaterialLine[] = [
    { key: "cement", label: "Cement", qty: result.cementBags, unit: "bags", hint: "cement" },
    { key: "sand", label: "Sand", qty: result.sandCft, unit: "cft", hint: "sand" },
    { key: "aggregate", label: "Aggregate / Bajri", qty: result.aggregateCft, unit: "cft", hint: "bajri" },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
        <NumberField label="Width (ft)" value={widthFt} onChange={setWidthFt} />
        <NumberField label="Thickness (in)" value={thicknessIn} onChange={setThicknessIn} />
        <div>
          <label className={labelClass}>Mix Ratio</label>
          <select value={ratio} onChange={(e) => setRatio(e.target.value)} className={inputClass}>
            <option value="1:3:6">1:3:6</option>
            <option value="1:4:8">1:4:8 (standard PCC)</option>
          </select>
        </div>
      </div>
      <ResultCard lines={lines} note={`Volume: ${result.volumeCft} cft`} />
      <AssignSection
        lines={lines}
        title="Foundation (PCC)"
        dimensionsNote={`${lengthFt}ft x ${widthFt}ft, ${thicknessIn}" thick`}
        customer={customer}
      />
    </>
  );
}

function PlasterForm({ customer }: { customer: Party | null }) {
  const [lengthFt, setLengthFt] = useState(10);
  const [heightFt, setHeightFt] = useState(10);
  const [thicknessIn, setThicknessIn] = useState(0.5);
  const [sandParts, setSandParts] = useState(4);

  const result = estimatePlaster({ lengthFt, heightFt, thicknessIn, sandParts });
  const lines: MaterialLine[] = [
    { key: "cement", label: "Cement", qty: result.cementBags, unit: "bags", hint: "cement" },
    { key: "sand", label: "Sand", qty: result.sandCft, unit: "cft", hint: "sand" },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Length (ft)" value={lengthFt} onChange={setLengthFt} />
        <NumberField label="Height (ft)" value={heightFt} onChange={setHeightFt} />
        <div>
          <label className={labelClass}>Thickness</label>
          <select value={thicknessIn} onChange={(e) => setThicknessIn(Number(e.target.value))} className={inputClass}>
            <option value={0.5}>1/2" (12mm, standard)</option>
            <option value={0.75}>3/4" (18mm, rough surface)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Mix Ratio</label>
          <select value={sandParts} onChange={(e) => setSandParts(Number(e.target.value))} className={inputClass}>
            <option value={4}>1:4 (cement:sand)</option>
            <option value={6}>1:6 (ceiling / rough)</option>
          </select>
        </div>
      </div>
      <ResultCard lines={lines} note={`Area: ${result.areaSqft} sqft`} />
      <AssignSection
        lines={lines}
        title="Plaster"
        dimensionsNote={`${lengthFt}ft x ${heightFt}ft, ${thicknessIn}" thick`}
        customer={customer}
      />
    </>
  );
}

function ResultCard({ lines, note }: { lines: MaterialLine[]; note: string }) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lines.map((line) => (
          <div key={line.key}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{line.label}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {line.qty} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{line.unit}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{note}</p>
    </div>
  );
}

type Assignment = { product: Product; quantity: number };

function AssignSection({
  lines,
  title,
  dimensionsNote,
  customer,
}: {
  lines: MaterialLine[];
  title: string;
  dimensionsNote: string;
  customer: Party | null;
}) {
  const navigate = useNavigate();
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [downloading, setDownloading] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);

  useEffect(() => {
    setAssignments({});
  }, [lines.map((l) => l.key).join(",")]);

  const assignedCount = Object.keys(assignments).length;
  const totalCost = Object.values(assignments).reduce((sum, a) => sum + a.quantity * Number(a.product.salePrice), 0);

  function assign(key: string, product: Product, qty: number) {
    setAssignments((prev) => ({ ...prev, [key]: { product, quantity: qty } }));
  }

  function unassign(key: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addToQuotation() {
    const state: EstimateQuotationState = {
      estimate: {
        items: Object.values(assignments).map((a) => ({
          productId: a.product.id,
          unitId: a.product.baseUnitId,
          quantity: a.quantity,
        })),
      },
    };
    navigate("/quotations/new", { state });
  }

  function startProject() {
    const state: ProjectEstimateState = {
      projectEstimate: {
        partyId: customer?.id ?? null,
        lines: Object.values(assignments).map((a) => ({
          productId: a.product.id,
          productName: a.product.name,
          targetQuantity: a.quantity,
          unitName: units?.find((u: Unit) => u.id === a.product.baseUnitId)?.name ?? "unit",
        })),
      },
    };
    navigate("/projects/new", { state });
  }

  async function downloadSlip() {
    setSlipError(null);
    setDownloading(true);
    try {
      const blob = await downloadEstimateSlip({
        title,
        dimensionsNote,
        customerName: customer?.name,
        lines: lines.map((line) => {
          const a = assignments[line.key];
          return {
            label: line.label,
            qty: line.qty,
            unit: line.unit,
            productName: a?.product.name,
            unitPrice: a ? Number(a.product.salePrice) : undefined,
          };
        }),
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setSlipError(axiosErrorMessage(err) ?? "Failed to generate estimate slip");
    } finally {
      setDownloading(false);
    }
  }

  function sendWhatsApp() {
    const message = buildMaterialEstimateMessage(title, dimensionsNote, lines, totalCost > 0 ? totalCost : null, customer?.name);
    const link = customer?.phone ? buildWhatsAppLink(customer.phone, message) : buildWhatsAppShareLink(message);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <PackagePlus size={16} className="text-gray-400" />
        Link to Products (optional)
      </h3>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Match each material to something you actually stock, then send it straight into a quotation.
      </p>
      <div className="mt-3 space-y-2">
        {lines.map((line) => {
          const assignment = assignments[line.key];
          return (
            <div key={line.key} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm text-gray-600 dark:text-gray-400">
                {line.label} <span className="text-gray-400">({line.qty} {line.unit})</span>
              </span>
              {assignment ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">{assignment.product.name}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={assignment.quantity}
                    onChange={(e) => assign(line.key, assignment.product, Math.max(0, Number(e.target.value)))}
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => unassign(line.key)}
                    aria-label={`Remove linked product for ${line.label}`}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <ProductPicker initialSearch={line.hint} onSelect={(p) => assign(line.key, p, line.qty)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {assignedCount > 0 && (
        <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Estimated cost (linked items only): {formatCurrency(totalCost)}
        </p>
      )}

      {slipError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{slipError}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={addToQuotation}
          disabled={assignedCount === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add {assignedCount || ""} Item{assignedCount === 1 ? "" : "s"} to Quotation
        </button>
        <button
          onClick={startProject}
          disabled={assignedCount === 0}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <HardHat size={14} />
          Start a Project
        </button>
        <button
          onClick={downloadSlip}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Download size={14} />
          {downloading ? "Preparing…" : "Print Slip (PDF)"}
        </button>
        <button
          onClick={sendWhatsApp}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <MessageCircle size={14} />
          Send via WhatsApp
        </button>
      </div>
    </div>
  );
}

export function EstimatorPage() {
  const [tab, setTab] = useState<Tab>("wall");
  const [customer, setCustomer] = useState<Party | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Calculator size={18} className="text-gray-400" />
          Material Estimator
        </h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Enter a customer's dimensions and get a quick material breakdown.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          This is a rule-of-thumb estimate using standard trade ratios — not a structural design. Actual quantities can
          vary with wastage, site conditions, and design. Confirm exact requirements with a contractor or engineer,
          especially for RCC slab and foundation work.
        </span>
      </div>

      <div>
        <label className={labelClass}>Customer (optional — names the printed/WhatsApp slip)</label>
        <PartyPicker
          type="customer"
          placeholder="Search or add a customer…"
          selected={customer}
          onSelect={setCustomer}
          onClear={() => setCustomer(null)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tItem) => (
          <button
            key={tItem.key}
            onClick={() => setTab(tItem.key)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === tItem.key
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tItem.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        {tab === "wall" && <WallForm key="wall" customer={customer} />}
        {tab === "slab" && <SlabForm key="slab" customer={customer} />}
        {tab === "pcc" && <PccForm key="pcc" customer={customer} />}
        {tab === "plaster" && <PlasterForm key="plaster" customer={customer} />}
      </div>
    </div>
  );
}
