import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import emailIngestedRoute from "./emailIngested";
import { z } from "zod";
import "dotenv/config";


const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const statusSchema = z.object({
  status: z.enum(["APPLIED", "INTERVIEWING", "REJECTED", "OFFER", "OTHER"])
});

// MVP auth: identify/create user by header
app.use(async (req, res, next) => {
  const email = req.header("x-user-email");
  if (!email) return res.status(401).json({ ok: false, error: "Missing x-user-email" });
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email } });
  (req as any).user = user;
  next();
});

// List applications for the current user
app.get("/applications", async (req, res) => {
  const user = (req as any).user;
  const apps = await prisma.application.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  console.log("GET /applications", { email: user.email, count: apps.length });
  res.json(apps);
});

// One application + its emails (timeline)
app.get("/applications/:id", async (req, res) => {
  const user = (req as any).user;
  const appId = req.params.id;
  const appRec = await prisma.application.findFirst({
    where: { id: appId, userId: user.id },
    include: {
      emails: { orderBy: { sentAt: "desc" } },
      statusEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!appRec) return res.status(404).json({ error: "Not found" });
  res.json(appRec);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(emailIngestedRoute);

// Update status + record a status event
app.patch("/applications/:id/status", async (req, res) => {
  const user = (req as any).user;
  const appId = req.params.id;

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const next = parsed.data.status;

  let appRec = await prisma.application.findFirst({
    where: { id: appId, userId: user.id }
  });
  if (!appRec) return res.status(404).json({ error: "Not found" });

  if (appRec.status !== next) {
    await prisma.statusEvent.create({
      data: { applicationId: appRec.id, fromStatus: appRec.status, toStatus: next, reason: "manual" }
    });
    appRec = await prisma.application.update({
      where: { id: appRec.id },
      data: { status: next, lastActivityAt: new Date() }
    });
  }

  res.json(appRec);
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
