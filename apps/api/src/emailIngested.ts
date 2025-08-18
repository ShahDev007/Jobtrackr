import { Router } from "express";
import { PrismaClient, AppStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function domainFromEmail(addr?: string | null) {
  if (!addr || !addr.includes("@")) return null;
  const domain = addr.split("@")[1].toLowerCase();
  return domain.split(".")[0] || null; // "airbnb.com" -> "airbnb"
}
function toStatus(s?: string | null): AppStatus {
  switch ((s || "").toUpperCase()) {
    case "APPLIED": return "APPLIED";
    case "INTERVIEWING": return "INTERVIEWING";
    case "REJECTED": return "REJECTED";
    case "OFFER": return "OFFER";
    default: return "OTHER";
  }
}

async function findByThread(userId: string, inReplyTo?: string | null, references?: string[] | null, providerThreadId?: string | null) {
  if (inReplyTo) {
    const hit = await prisma.email.findFirst({ where: { userId, OR: [{ messageId: inReplyTo }, { providerMessageId: inReplyTo }] } });
    if (hit?.applicationId) return prisma.application.findFirst({ where: { id: hit.applicationId, userId } });
  }
  if (references?.length) {
    const hit = await prisma.email.findFirst({ where: { userId, messageId: { in: references } } });
    if (hit?.applicationId) return prisma.application.findFirst({ where: { id: hit.applicationId, userId } });
  }
  if (providerThreadId) {
    const hit = await prisma.email.findFirst({
      where: { userId, headersJson: { path: ["providerThreadId"], equals: providerThreadId as any } }
    });
    if (hit?.applicationId) return prisma.application.findFirst({ where: { id: hit.applicationId, userId } });
  }
  return null;
}
async function findRecentByCompany(userId: string, company: string) {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return prisma.application.findFirst({
    where: { userId, company: { equals: company, mode: "insensitive" }, updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: "desc" }
  });
}

const handlerPath = "/events/email-ingested";
router.post(handlerPath, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      provider, providerMessageId, providerThreadId,
      messageId, inReplyTo, references,
      from, to, cc, sentAt, subject, snippet, bodyText, bodyHtml, headers,
      classification, inferredCompany, inferredRole
    } = req.body || {};

    if (!messageId && !(provider && providerMessageId)) {
      return res.status(400).json({ ok: false, error: "Missing messageId and providerMessageId" });
    }
    if (!provider || !sentAt || !subject) {
      return res.status(400).json({ ok: false, error: "Missing provider/sentAt/subject" });
    }

    // idempotent email upsert
    let emailRec = messageId
      ? await prisma.email.findFirst({ where: { userId: user.id, messageId } })
      : null;
    if (!emailRec && providerMessageId) {
      emailRec = await prisma.email.findFirst({ where: { userId: user.id, providerMessageId } });
    }

    const emailData = {
      userId: user.id,
      providerMessageId: providerMessageId ?? null,
      messageId: messageId ?? null,
      inReplyTo: inReplyTo ?? null,
      fromName: from?.name ?? null,
      fromEmail: from?.email ?? null,
      toEmails: Array.isArray(to) ? to.join(",") : null,
      ccEmails: Array.isArray(cc) ? cc.join(",") : null,
      sentAt: new Date(sentAt),
      subject,
      snippet: snippet ?? null,
      bodyText: bodyText ?? null,
      bodyHtml: bodyHtml ?? null,
      headersJson: headers ? { ...headers, providerThreadId: providerThreadId ?? null } : (providerThreadId ? { providerThreadId } : {})
    };

    if (!emailRec) emailRec = await prisma.email.create({ data: emailData });
    else await prisma.email.update({ where: { id: emailRec.id }, data: emailData });

    // link/create application
    let app = await findByThread(user.id, inReplyTo, references, providerThreadId);
    const companyGuess = (inferredCompany && inferredCompany.trim()) || domainFromEmail(from?.email) || "Unknown";
    if (!app) app = await findRecentByCompany(user.id, companyGuess);
    if (!app) {
      app = await prisma.application.create({
        data: {
          userId: user.id,
          company: companyGuess,
          roleTitle: (inferredRole && inferredRole.trim()) || "Unknown",
          status: toStatus(classification),
          lastActivityAt: new Date(sentAt)
        }
      });
    }

    if (!emailRec.applicationId || emailRec.applicationId !== app.id) {
      await prisma.email.update({ where: { id: emailRec.id }, data: { applicationId: app.id } });
    }

    const desired = toStatus(classification);
    let statusChanged = false;
    if (desired !== app.status) {
      await prisma.statusEvent.create({
        data: { applicationId: app.id, fromStatus: app.status, toStatus: desired, reason: "auto" }
      });
      app = await prisma.application.update({
        where: { id: app.id }, data: { status: desired, lastActivityAt: new Date(sentAt) }
      });
      statusChanged = true;
    } else {
      await prisma.application.update({ where: { id: app.id }, data: { lastActivityAt: new Date(sentAt) } });
    }

    res.json({ ok: true, applicationId: app.id, emailId: emailRec.id, statusChanged, newStatus: app.status });
  } catch (e) {
    console.error("email-ingested error", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
