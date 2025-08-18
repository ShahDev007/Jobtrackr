import { useEffect, useMemo, useState } from "react";
import { getApplications, getApplication, updateApplicationStatus } from "./api";
import type { Application, ApplicationWithDetails, AppStatus } from "./types";
import {
  DndContext,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

const STATUSES: AppStatus[] = ["APPLIED","INTERVIEWING","REJECTED","OFFER","OTHER"];


function groupByStatus(apps: Application[]) {
  const map: Record<AppStatus, Application[]> = { APPLIED:[], INTERVIEWING:[], REJECTED:[], OFFER:[], OTHER:[] };
  for (const a of apps) map[a.status]?.push(a);
  for (const s of STATUSES) map[s].sort((a,b)=> (b.updatedAt > a.updatedAt ? 1 : -1));
  return map;
}
const prettyDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : "—";

// ---- DnD helpers ----
function DroppableColumn(props: { id: AppStatus; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });
  return (
    <div ref={setNodeRef} className={props.className + (isOver ? " ring-2 ring-black/40" : "")}>
      {props.children}
    </div>
  );
}
function DraggableCard({
  id,
  children,
  className,
  onClick,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`relative w-full text-left rounded border p-3 bg-white pr-10 transition ${
        isDragging ? "opacity-70" : ""
      } ${className || ""}`}
    >
      {children}

      {/* Drag handle in the top-right; only this has the dnd listeners */}
      <span
        {...attributes}
        {...listeners}
        aria-label="Drag"
        title="Drag"
        className="absolute right-2 top-2 cursor-grab active:cursor-grabbing select-none px-2 py-1 text-xs border rounded bg-gray-50"
      >
        ≡
      </span>
    </button>
  );
}



export default function App() {
  const [email, setEmail] = useState<string>(import.meta.env.VITE_DEFAULT_USER_EMAIL || "");
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ApplicationWithDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setApps(await getApplications(email)); }
    catch (e:any) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function openDetails(id: string) {
    setSelectedId(id); setLoadingDetails(true); setDetailsError(null);
    try { setDetails(await getApplication(id, email)); }
    catch (e:any) { setDetailsError(e?.message || "Failed to fetch details"); }
    finally { setLoadingDetails(false); }
  }
  function closeDetails() { setSelectedId(null); setDetails(null); }

  async function setStatus(id: string, next: AppStatus) {
    await updateApplicationStatus(id, next, email);
    await load();
    if (selectedId === id) setDetails(await getApplication(id, email));
  }

  const grouped = useMemo(() => groupByStatus(apps || []), [apps]);

  function onDragEnd(evt: DragEndEvent) {
    const appId = String(evt.active.id);
    const overId = evt.over?.id as AppStatus | undefined;
    if (!overId) return;

    const app = (apps || []).find(a => a.id === appId);
    if (!app) return;
    const from = app.status;
    const to = overId;
    if (from !== to) {
      setStatus(appId, to).catch(err => alert(err?.message || "Failed to update status"));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">JobTrackr • Dashboard</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="x-user-email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />
          <button
            className="rounded bg-black text-white px-4 py-2 text-sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && <div className="mb-4 text-red-600">API error {error}</div>}

      <DndContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-5">
          {STATUSES.map((s) => (
            <DroppableColumn key={s} id={s} className="bg-white rounded-lg shadow-sm border">
              <div className="px-4 py-3 border-b font-semibold">{s}</div>
              <div className="p-3 space-y-2 min-h-[120px]">
                {(grouped[s] || []).length === 0 && (
                  <div className="text-sm text-gray-500">No items</div>
                )}
                {(grouped[s] || []).map(a => (
                  <DraggableCard
                    key={a.id}
                    id={a.id}
                    onClick={()=>openDetails(a.id)}
                    className="hover:shadow-sm"
                  >
                    <div className="font-medium">{a.company}</div>
                    <div className="text-sm text-gray-600">{a.roleTitle}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Last activity: {prettyDate(a.lastActivityAt || a.updatedAt)}
                    </div>
                  </DraggableCard>
                ))}
              </div>
            </DroppableColumn>
          ))}
        </div>
      </DndContext>

      {/* Details side panel (unchanged) */}
      {selectedId && (
  <div
    className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
    onMouseDown={closeDetails}                 // use mouse down on overlay
  >
    <div
      className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl"
      onMouseDown={(e) => e.stopPropagation()} // block overlay close when interacting inside
    >
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">Application Details</div>
              <button className="text-sm" onClick={closeDetails}>Close</button>
            </div>

            {loadingDetails && <div className="p-4 text-sm text-gray-500">Loading…</div>}
            {detailsError && <div className="p-4 text-sm text-red-600">{detailsError}</div>}

            {details && (
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{details.company}</div>
                    <div className="text-sm text-gray-600">{details.roleTitle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Status</label>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={details.status}
                      onChange={(e)=>setStatus(details.id, e.target.value as AppStatus)}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-2">Emails</div>
                  {details.emails.length === 0 ? (
                    <div className="text-sm text-gray-500">No emails yet</div>
                  ) : (
                    <ul className="space-y-3">
                      {details.emails.map(em => (
                        <li key={em.id} className="border rounded p-3">
                          <div className="text-sm font-medium">{em.subject}</div>
                          <div className="text-xs text-gray-600">
                            From {em.fromName || em.fromEmail} • {prettyDate(em.sentAt)}
                          </div>
                          {em.snippet && <div className="text-sm mt-1 text-gray-700">{em.snippet}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="font-semibold mb-2">Status history</div>
                  {details.statusEvents.length === 0 ? (
                    <div className="text-sm text-gray-500">No status changes</div>
                  ) : (
                    <ul className="text-sm space-y-2">
                      {details.statusEvents.map(ev => (
                        <li key={ev.id} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{ev.fromStatus ?? "—"}</span>
                            <span className="mx-2">→</span>
                            <span className="font-medium">{ev.toStatus}</span>
                          </div>
                          <div className="text-gray-500">{prettyDate(ev.createdAt)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="mt-8 text-xs text-gray-500">
        Reading from <code>{import.meta.env.VITE_API_URL}</code> as header <code>x-user-email: {email}</code>
      </footer>
    </div>
  );
}
