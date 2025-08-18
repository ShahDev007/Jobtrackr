export type AppStatus = "APPLIED" | "INTERVIEWING" | "REJECTED" | "OFFER" | "OTHER";

export interface Application {
  id: string;
  userId: string;
  company: string;
  roleTitle: string;
  status: AppStatus;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Email {
  id: string;
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  sentAt: string;
  snippet?: string | null;
  bodyText?: string | null;
}

export interface StatusEvent {
  id: string;
  fromStatus: AppStatus | null;
  toStatus: AppStatus;
  createdAt: string;
}

export interface ApplicationWithDetails extends Application {
  emails: Email[];
  statusEvents: StatusEvent[];
}
