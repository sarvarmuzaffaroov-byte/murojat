export type ApplicantType =
  | 'Talaba'
  | 'Professor-o‘qituvchi'
  | 'Filial xodimi'
  | 'Ota-ona'
  | 'Fuqaro';

export type AppealCategory =
  | 'Ta’lim jarayoni'
  | 'Kontrakt va moliyaviy masalalar'
  | 'Yotoqxona'
  | 'Ishga joylashish'
  | 'Taklif va tashabbuslar'
  | 'Shikoyat'
  | 'Korrupsiyaga oid murojaatlar'
  | 'Boshqa masalalar';

export type AppealStatus =
  | 'Yangi'
  | 'Qabul qilindi'
  | 'Ko‘rib chiqilmoqda'
  | 'Mas’ul xodimga yuborildi'
  | 'Javob tayyorlandi'
  | 'Yakunlandi';

export interface HistoryItem {
  id: string;
  timestamp: string;
  action: string;
  status?: AppealStatus;
  comment?: string;
  author: string;
}

export interface AppealAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export interface Appeal {
  id: string;
  trackingCode: string;
  createdAt: string;
  updatedAt: string;
  fullName: string;
  phone: string;
  email?: string;
  applicantType: ApplicantType;
  category: AppealCategory;
  subject: string;
  content: string;
  attachment?: AppealAttachment | null;
  consent: boolean;
  status: AppealStatus;
  assignedDepartment?: string;
  assignedOfficer?: string;
  deadline?: string;
  officialResponse?: string;
  responseAttachment?: AppealAttachment | null;
  internalNotes?: string;
  history: HistoryItem[];
}

export interface AppealStats {
  total: number;
  new: number;
  underReview: number;
  assigned: number;
  answered: number;
  completed: number;
  categoryDistribution: Record<string, number>;
  applicantTypeDistribution: Record<string, number>;
  monthlyTrends: { month: string; count: number; completed: number }[];
}

export interface ReceptionScheduleItem {
  role: string;
  person: string;
  time: string;
  room: string;
}

export interface BranchSettings {
  address: string;
  landmark: string;
  phonePrimary: string;
  phoneSecondary: string;
  hotline: string;
  email: string;
  telegram: string;
  workDays: string;
  workHours: string;
  lunchTime: string;
  receptionList: ReceptionScheduleItem[];
}
