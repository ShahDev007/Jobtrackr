const BASE = import.meta.env.VITE_API_URL;
const DEFAULT_EMAIL = import.meta.env.VITE_DEFAULT_USER_EMAIL;

function headersFor(userEmail?: string) {
  return { "x-user-email": userEmail || DEFAULT_EMAIL };
}

export async function getApplications(userEmail?: string) {
  const res = await fetch(`${BASE}/applications`, { headers: headersFor(userEmail) });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as import("./types").Application[];
}

export async function getApplication(id: string, userEmail?: string) {
  const res = await fetch(`${BASE}/applications/${id}`, { headers: headersFor(userEmail) });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as import("./types").ApplicationWithDetails;
}

export async function updateApplicationStatus(
  id: string,
  status: import("./types").AppStatus,
  userEmail?: string
) {
  const res = await fetch(`${BASE}/applications/${id}/status`, {
    method: "PATCH",
    headers: { ...headersFor(userEmail), "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as import("./types").Application;
}
