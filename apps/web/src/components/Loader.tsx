import "./Loader.css";

/** A small brick wall being built, in a loop — the construction-themed stand-in for a
 * generic spinner, used everywhere a page/section shows a loading state.
 * size="sm" drops the ground line and label for tight spots (e.g. an avatar overlay). */
export function Loader({
  label = "Loading…",
  full = false,
  size = "md",
}: {
  label?: string | null;
  full?: boolean;
  size?: "sm" | "md";
}) {
  if (size === "sm") {
    return (
      <div className="loader-wrap loader-wrap-sm">
        <div className="loader-bricks loader-bricks-sm" role="status" aria-label={label ?? "Loading"}>
          <span className="loader-brick loader-brick-sm" />
          <span className="loader-brick loader-brick-sm" />
          <span className="loader-brick loader-brick-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className={`loader-wrap ${full ? "loader-wrap-full" : ""}`}>
      <div className="loader-bricks" role="status" aria-label={label ?? "Loading"}>
        <span className="loader-brick" />
        <span className="loader-brick" />
        <span className="loader-brick" />
        <span className="loader-brick" />
        <span className="loader-brick" />
      </div>
      <div className="loader-ground" />
      {label && <p className="loader-label">{label}</p>}
    </div>
  );
}
