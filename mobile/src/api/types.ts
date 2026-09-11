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

export type Transaction = {
  id: string;
  code: string;
  type: 'SALARY_PAYMENT' | 'WITHDRAWAL' | 'PLATFORM_FEE' | 'REFUND';
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  amount: number;
  fromLabel: string;
  toLabel: string;
  failureReason: string | null;
  refundReason: string | null;
  occurredAt: string;
  worker?: { id: string; fullName: string; code: string } | null;
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
};

export type Notification = {
  id: string;
  kind: 'SOS' | 'VERIFICATION' | 'PAYMENT' | 'FRAUD' | 'JOB';
  title: string;
  body: string | null;
  read: boolean;
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
