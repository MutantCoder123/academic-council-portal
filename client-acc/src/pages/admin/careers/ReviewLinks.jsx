// Review queue tab: links submitted by students and what happened to each one. Admins can retry a
// failed link or turn a link into a manual posting (P5-T4, F-09); nothing is deleted (D-01).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, PenLine, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { careersAdminApi, errorMessage } from "../../../api/careersApi";
import { Skeleton, cardClass, inputClass } from "./components/ui";
import { safeHref } from "../../Careers/lib/format";

const STATUSES = ["ALL", "RECEIVED", "PROCESSING", "EXTRACTING", "PENDING_REVIEW", "STORED_ONLY", "DUPLICATE", "FAILED"];
const STYLE = {
  FAILED: "text-rose-700 bg-rose-50 border-rose-100",
  STORED_ONLY: "text-slate-600 bg-slate-100 border-slate-200",
  DUPLICATE: "text-slate-600 bg-slate-100 border-slate-200",
  PENDING_REVIEW: "text-emerald-700 bg-emerald-50 border-emerald-100",
};

const smallButton = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer";

export default function ReviewLinks({ refreshKey, onOpenPosting }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("ALL");
  const [items, setItems] = useState(null);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const retry = async (s) => {
    setBusyId(s.id);
    try {
      const res = await careersAdminApi.retrySubmission(s.id);
      toast.success(res.message);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };
  const createPosting = (s) => navigate(`/admin/careers/new?fromLink=${s.id}&url=${encodeURIComponent(s.url)}`);

  useEffect(() => {
    let alive = true;
    careersAdminApi.listSubmissions({ status, limit: 100 })
      .then((res) => alive && setItems(res.data))
      .catch((err) => toast.error(errorMessage(err, "Could not load student links.")));
    return () => {
      alive = false;
    };
  }, [status, refreshKey, reload]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="links-status" className="text-xs font-semibold text-slate-600">Status</label>
        <select id="links-status" className={`${inputClass} w-48`} value={status} onChange={(e) => { setStatus(e.target.value); setItems(null); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
        </select>
      </div>
      {!items ? <Skeleton rows={4} /> : !items.length ? (
        <div className={`${cardClass} p-8 text-center text-sm text-slate-500`}>No student links{status !== "ALL" ? ` with status ${status.toLowerCase().replace("_", " ")}` : " yet"}.</div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <ul className="divide-y divide-slate-100">
            {items.map((s) => (
              <li key={s.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center gap-2">
                  {s.dismissedAt ? (
                    <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border-slate-200">{s.dismissedById === s.submittedById ? "Withdrawn" : "Dismissed"}</span>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${STYLE[s.status] || "text-blue-700 bg-blue-50 border-blue-100"}`}>{s.status.replace("_", " ")}</span>
                  )}
                  <a href={safeHref(s.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-secondary)] hover:underline truncate inline-flex items-center gap-1 min-w-0">
                    <span className="truncate">{s.url}</span> <ExternalLink size={12} className="shrink-0" />
                  </a>
                </div>
                <p className="text-xs text-slate-500">
                  By {s.submittedBy ?? `user #${s.submittedById}`} · {new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {s.postingId && <> · <button type="button" className="text-[var(--color-secondary)] hover:underline cursor-pointer" onClick={() => onOpenPosting(s.postingId)}>posting #{s.postingId}</button></>}
                </p>
                {s.note && <p className="text-xs text-slate-600">Note: {s.note}</p>}
                {s.error && <p className="text-xs text-rose-700">{s.error}</p>}
                {s.dismissedAt && (
                  <p className="text-xs text-slate-600">
                    {s.dismissedById === s.submittedById ? "Withdrawn by the student" : `Dismissed: ${s.dismissReason}`} · {new Date(s.dismissedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
                {!s.dismissedAt && (s.status === "FAILED" || !s.postingId) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {s.status === "FAILED" && (
                      <button type="button" className={smallButton} onClick={() => retry(s)} disabled={busyId === s.id}><RotateCcw size={13} aria-hidden="true" /> Retry</button>
                    )}
                    {!s.postingId && (
                      <button type="button" className={smallButton} onClick={() => createPosting(s)}><PenLine size={13} aria-hidden="true" /> Create posting from this link</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
