export type Page<T> = { items: T[]; meta: { total: number; page: number; limit: number; pages: number } };

export type WorkerStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
export type Availability = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';

export type Worker = {
  id: string;
  code: string;
  fullName: string;
  initials: string;
  profession: string;
  status: WorkerStatus;
  availability: Availability;
  phone: string;
  email: string | null;
  address: string;
  bio: string | null;
  education: string | null;
  lastCompany: string | null;
  experienceMonths: number;
  rating: number;
  reviewCount: number;
  trustScore: number;
  totalJobs: number;
  completionRate: number;
  totalEarnings: number;
  salaryMin: number | null;
  salaryMax: number | null;
  /// Platform wallet balance, in paisa — was previously invisible to admins.
  balance: number;
  joinedAt: string;
  skills?: { name: string }[];
  certifications?: { id: string; name: string; issuer: string | null; year: number | null }[];
  jobHistory?: JobHistoryEntry[];
};

export type JobHistoryEntry = {
  id: string;
  company: string;
  role: string;
  startedAt: string;
  endedAt: string | null;
};

export type JobStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Job = {
  id: string;
  code: string;
  title: string;
  description: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  availability: Availability;
  experienceMonths: number;
  status: JobStatus;
  urgency: 'NORMAL' | 'URGENT';
  featured: boolean;
  rejectionReason: string | null;
  views: number;
  postedAt: string;
  company: { id: string; name: string; initials: string };
  category: { id: string; slug: string; name: string; icon: string };
  _count: { applications: number };
};

export type ApplicationStatus = 'APPLIED' | 'SHORTLISTED' | 'HIRED' | 'REJECTED';

export type JobApplication = {
  id: string;
  jobId: string;
  workerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  hiredAt: string | null;
  worker: {
    id: string;
    code: string;
    fullName: string;
    initials: string;
    profession: string;
    rating: number;
    trustScore: number;
  };
};

export type PaymentMethod = 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER' | 'CARD' | 'CASH';

export type Transaction = {
  id: string;
  code: string;
  type: 'SALARY_PAYMENT' | 'WITHDRAWAL' | 'PLATFORM_FEE' | 'REFUND';
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  amount: number;
  method: PaymentMethod;
  fromLabel: string;
  toLabel: string;
  failureReason: string | null;
  refundReason: string | null;
  occurredAt: string;
  worker?: { id: string; fullName: string; code: string } | null;
  job?: { id: string; title: string; code: string } | null;
  relatedTransaction?: { id: string; code: string; amount: number } | null;
  refunds?: { id: string; code: string; amount: number; status: string }[];
  /// Only present when the list was fetched scoped to one worker — 'IN' for
  /// money credited to their wallet, 'OUT' for money debited from it.
  direction?: 'IN' | 'OUT';
};

/// Extra block returned only when GET /payments/transactions (or
/// GET /workers/:id/transactions) is scoped to a single worker.
export type WorkerTransactionsPage = Page<Transaction> & {
  last30Days?: { cashIn: number; cashOut: number };
};

export type VerificationType = 'NID' | 'FACE' | 'BUSINESS' | 'WORKER' | 'EMPLOYER' | 'COMPANY';

export type VerificationRequest = {
  id: string;
  type: VerificationType;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  subjectName: string;
  documentUrl: string | null;
  reviewNote: string | null;
  submittedAt: string;
};

export type Alert = {
  id: string;
  kind: 'SOS' | 'SUSPICIOUS_LOGIN' | 'FAKE_GPS' | 'FAILED_VERIFICATION' | 'FRAUD';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ESCALATED' | 'RESOLVED';
  message: string;
  subjectName: string;
  latitude: number | null;
  longitude: number | null;
  device: string | null;
  actionTaken: string | null;
  detectedAt: string;
  worker?: { id: string; fullName: string; code: string } | null;
  /// Item 12 — which company the activity came from, shown on the card and
  /// used to pick the manager an escalation is routed to.
  companyId: string | null;
  companyLabel: string | null;
  company?: { id: string; name: string; initials: string; industry: string | null } | null;
  escalatedAt: string | null;
  escalationNote: string | null;
  escalatedToManager?: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Items 7-12 — things the platform says to an end user, and the admin tools
// that produce them.
// ---------------------------------------------------------------------------

export type UserNotificationKind =
  | 'JOB_REJECTED'
  | 'BAN_WARNING'
  | 'BAN_APPLIED'
  | 'BAN_CANCELLED'
  | 'SUPPORT_REPLY'
  | 'ALERT_ESCALATION'
  | 'INTERVIEW'
  | 'GENERAL';

export type UserNotification = {
  id: string;
  kind: UserNotificationKind;
  audience: 'WORKER' | 'EMPLOYER';
  workerId: string | null;
  employerId: string | null;
  title: string;
  body: string;
  /// Item 7 — the admin's written reason, kept apart from the body so it can
  /// be rendered as a quoted block.
  reason: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
  worker?: { id: string; code: string; fullName: string } | null;
  employer?: { id: string; code: string; fullName: string } | null;
};

export type BanStatus = 'SCHEDULED' | 'EXECUTED' | 'CANCELLED';

export type ScheduledBan = {
  id: string;
  workerId: string;
  reason: string;
  noticeText: string;
  status: BanStatus;
  effectiveAt: string;
  executedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  triggerTransactionId: string | null;
  createdAt: string;
  worker?: {
    id: string;
    code: string;
    fullName: string;
    initials: string;
    status: WorkerStatus;
    phone?: string;
    email?: string | null;
  };
};

export type IrregularFlag = { code: string; detail: string };

export type IrregularWorker = {
  workerId: string;
  worker: {
    id: string;
    code: string;
    fullName: string;
    initials: string;
    status: WorkerStatus;
  } | null;
  flags: IrregularFlag[];
  transactionCount: number;
  totalAmount: number;
  lastActivityAt: string;
  sampleTransaction: { id: string; code: string };
  openBan: { id: string; effectiveAt: string } | null;
};

export type IrregularTransactions = {
  items: IrregularWorker[];
  windowHours: number;
  thresholds: { largeAmount: number; burstCount: number; failureCount: number };
};

export type InterviewMode = 'IN_PERSON' | 'PHONE' | 'VIDEO';
export type InterviewStatus =
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type Interview = {
  id: string;
  jobId: string;
  workerId: string;
  applicationId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  status: InterviewStatus;
  location: string | null;
  interviewerName: string | null;
  notes: string | null;
  outcome: string | null;
  createdAt: string;
  worker: {
    id: string;
    code: string;
    fullName: string;
    initials: string;
    profession: string;
    phone: string;
  };
  job: {
    id: string;
    code: string;
    title: string;
    location: string;
    company: { id: string; name: string; initials: string };
  };
};

export type InterviewCounts = {
  all: number;
  upcoming: number;
  today: number;
  completed: number;
  cancelled: number;
};

export type DocumentKind =
  | 'NID'
  | 'PASSPORT'
  | 'BIRTH_CERTIFICATE'
  | 'CERTIFICATE'
  | 'CV'
  | 'CONTRACT'
  | 'PHOTO'
  | 'TRADE_LICENSE'
  | 'OTHER';

export type StoredDocument = {
  id: string;
  ownerType: 'WORKER' | 'EMPLOYER';
  workerId: string | null;
  employerId: string | null;
  jobId: string | null;
  kind: DocumentKind;
  fileName: string;
  /// Derived server-side from user id + job id — never typed by hand.
  storageKey: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
  uploadedAt: string;
  job?: { id: string; code: string; title: string } | null;
};

/// Item 11 — the by-user view: the owner's full profile plus their documents
/// grouped into one folder per job.
export type DocumentsByUser = {
  ownerType: 'WORKER' | 'EMPLOYER';
  user: Worker;
  total: number;
  groups: {
    jobId: string | null;
    job: { id: string; code: string; title: string } | null;
    documents: StoredDocument[];
  }[];
};

export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';

export type ComplaintReply = {
  id: string;
  message: string;
  createdAt: string;
  /// Item 9 — a reply can now come from the user who wrote in, or from the
  /// instant auto-reply, so the admin is only present on ADMIN rows.
  authorType: 'ADMIN' | 'USER' | 'SYSTEM';
  authorName: string | null;
  auto: boolean;
  admin: { id: string; displayName: string } | null;
};

export type Complaint = {
  id: string;
  code: string;
  subject: string;
  body: string;
  status: ComplaintStatus;
  reporterName: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporterWorkerId: string | null;
  reporterEmployerId: string | null;
  /// Set the moment the auto-reply went out (item 9).
  autoRepliedAt: string | null;
  assignedAdmin?: { id: string; displayName: string; email: string } | null;
  replies?: ComplaintReply[];
};

export type Notification = {
  id: string;
  kind: 'SOS' | 'VERIFICATION' | 'PAYMENT' | 'FRAUD' | 'JOB' | 'MAINTENANCE';
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
};

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PRO';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type SubscriberType = 'WORKER' | 'EMPLOYER';

export type Subscription = {
  id: string;
  subscriberType: SubscriberType;
  subscriberId: string | null;
  subscriberName: string;
  subscriberCode: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  price: number;
  startedAt: string;
  expiresAt: string | null;
  /// Lifetime sum of this subscriber's completed transactions (paisa).
  totalTransacted: number;
};

export type SubscriptionSummary = { total: number; byPlan: Record<SubscriptionPlan, number> };

export type MaintenanceWindow = {
  id: string;
  title: string;
  message: string | null;
  scheduledAt: string;
  notified60At: string | null;
  notified30At: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type DashboardOverview = {
  overview: { totalWorkers: number; totalRevenue: number; employers: number; pendingVerify: number };
  workerStatus: { verified: number; pending: number; rejected: number; suspended: number };
  liveAlerts: Alert[];
  notifications: { items: Notification[]; unread: number };
};

export type PaymentsSummary = {
  totalRevenue: number;
  monthlyRevenue: number;
  walletBalance: number;
  pendingPayouts: number;
};
