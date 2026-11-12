import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import type { 
  Appeal, 
  AppealStats, 
  AppealStatus, 
  BranchSettings 
} from './src/types/appeal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

const DATA_DIR = path.resolve(__dirname, 'data');
const APPEALS_FILE = path.resolve(DATA_DIR, 'appeals.json');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');
const ADMIN_FILE = path.resolve(DATA_DIR, 'admin.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default Branch Settings
const DEFAULT_SETTINGS: BranchSettings = {
  address: 'Sirdaryo viloyati, Yangiyer shahri, Tinchlik ko‘chasi, 1-uy',
  landmark: 'Yangiyer shahar markazi',
  phonePrimary: '+998 (67) 250-12-34',
  phoneSecondary: '+998 (67) 250-10-06',
  hotline: '+998 (67) 250-12-34',
  email: 'info@yangiyer-tkti.uz',
  telegram: '@tkti_yangiyer_filiali',
  workDays: 'Dushanba — Juma',
  workHours: '09:00 — 18:00',
  lunchTime: '13:00 — 14:00',
  receptionList: [
    {
      role: 'Filial direktori',
      person: 'Filial direktori qabulxonasi',
      time: 'Chorshanba: 15:00 — 17:00',
      room: '201-xona (Bosh bino)'
    },
    {
      role: 'O‘quv ishlari bo‘yicha direktor o‘rinbosari',
      person: 'O‘quv-uslubiy bo‘lim mudiri',
      time: 'Seshanba va Payshanba: 14:00 — 17:00',
      room: '205-xona'
    },
    {
      role: 'Yoshlar masalalari va ma’naviy-ma’rifiy ishlar bo‘yicha direktor o‘rinbosari',
      person: 'Yoshlar bilan ishlash bo‘limi',
      time: 'Dushanba va Juma: 10:00 — 13:00',
      room: '114-xona'
    },
    {
      role: 'Korrupsiyaga qarshi kurashish "Komplayens-nazorat" bo‘limi',
      person: 'Bosh mutaxassis',
      time: 'Har ish kuni: 09:00 — 17:00',
      room: '108-xona'
    }
  ]
};

// Password Hashing Helper
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

// Ensure admin credentials exist
function initAdminCredentials() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const defaultPassword = process.env.ADMIN_PASSWORD || 'yangiyer2026';
    const passwordHash = hashPassword(defaultPassword, salt);
    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ username: 'admin', salt, passwordHash }, null, 2),
      'utf8'
    );
  }
}
initAdminCredentials();

// Anti-spam sliding window rate limiter (max 6 requests per 10 minutes per IP)
const ipSubmissionTracker: Record<string, number[]> = {};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxSubmissions = 8;

  if (!ipSubmissionTracker[ip]) {
    ipSubmissionTracker[ip] = [];
  }

  // Filter out timestamps older than windowMs
  ipSubmissionTracker[ip] = ipSubmissionTracker[ip].filter(t => now - t < windowMs);

  if (ipSubmissionTracker[ip].length >= maxSubmissions) {
    return false;
  }

  ipSubmissionTracker[ip].push(now);
  return true;
}

// Load and Save Appeals
function loadAppeals(): Appeal[] {
  try {
    if (!fs.existsSync(APPEALS_FILE)) {
      fs.writeFileSync(APPEALS_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(APPEALS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading appeals.json:', err);
    return [];
  }
}

function saveAppeals(appeals: Appeal[]): boolean {
  try {
    fs.writeFileSync(APPEALS_FILE, JSON.stringify(appeals, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving appeals.json:', err);
    return false;
  }
}

// Load and Save Settings
function loadSettings(): BranchSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading settings.json:', err);
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: BranchSettings): boolean {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving settings.json:', err);
    return false;
  }
}

// Normalize phone to match last 9 digits (Uzbekistan mobile format)
function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

// Generate unique sequential appeal ID: TKTI-2026-0001, 0002...
function generateAppealId(appeals: Appeal[]): string {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const a of appeals) {
    const match = a.id.match(new RegExp(`^TKTI-${year}-(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `TKTI-${year}-${nextSeq}`;
}

// Compute 100% REAL statistics from database items
function computeRealStats(appeals: Appeal[]): AppealStats {
  const total = appeals.length;
  let newCount = 0;
  let underReviewCount = 0;
  let assignedCount = 0;
  let answeredCount = 0;
  let completedCount = 0;

  const categoryDistribution: Record<string, number> = {};
  const applicantTypeDistribution: Record<string, number> = {};
  const monthlyMap: Record<string, { count: number; completed: number }> = {};

  const monthNames = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];

  for (const a of appeals) {
    const st = a.status as string;
    if (st === 'Yangi' || st === 'Yangi yuborildi') {
      newCount++;
    } else if (st === 'Ko‘rib chiqilmoqda' || st === 'Qabul qilindi') {
      underReviewCount++;
    } else if (st === 'Mas’ul xodimga yuborildi' || st === 'Mas’ul bo‘limga yuborildi') {
      assignedCount++;
    } else if (st === 'Javob tayyorlandi') {
      answeredCount++;
    } else if (st === 'Yakunlandi') {
      completedCount++;
    }

    if (a.category) {
      categoryDistribution[a.category] = (categoryDistribution[a.category] || 0) + 1;
    }
    if (a.applicantType) {
      applicantTypeDistribution[a.applicantType] = (applicantTypeDistribution[a.applicantType] || 0) + 1;
    }

    if (a.createdAt) {
      const d = new Date(a.createdAt);
      if (!isNaN(d.getTime())) {
        const mName = monthNames[d.getMonth()];
        if (!monthlyMap[mName]) {
          monthlyMap[mName] = { count: 0, completed: 0 };
        }
        monthlyMap[mName].count++;
        if (a.status === 'Yakunlandi') {
          monthlyMap[mName].completed++;
        }
      }
    }
  }

  const monthlyTrends = Object.entries(monthlyMap).map(([month, data]) => ({
    month,
    count: data.count,
    completed: data.completed
  }));

  return {
    total,
    new: newCount,
    underReview: underReviewCount,
    assigned: assignedCount,
    answered: answeredCount,
    completed: completedCount,
    categoryDistribution,
    applicantTypeDistribution,
    monthlyTrends
  };
}

// Admin Token Session Store
const activeAdminTokens = new Set<string>();

function adminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o‘tilmagan' });
  }
  const token = authHeader.slice(7).trim();
  if (!activeAdminTokens.has(token)) {
    return res.status(401).json({ error: 'Sessiya muddati tugagan yoki token noto‘g‘ri' });
  }
  next();
}

// ================= PUBLIC API ROUTES =================

// 1. Get Branch Settings (Public)
app.get('/api/settings', (_req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ error: 'Sozlamalarni yuklab bo‘lmadi' });
  }
});

// 2. Submit Appeal (Public)
app.post('/api/appeals', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Juda ko‘p so‘rov yuborildi. Iltimos, 10 daqiqadan so‘ng qayta urinib ko‘ring.'
      });
    }

    const {
      fullName,
      phone,
      email,
      applicantType,
      category,
      subject,
      content,
      attachment
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'F.I.Sh. kiritilishi majburiy' });
    }

    if (!phone || !phone.trim() || phone.replace(/\D/g, '').length < 9) {
      return res.status(400).json({ error: 'To‘g‘ri telefon raqami kiritilishi shart' });
    }

    if (!applicantType) {
      return res.status(400).json({ error: 'Murojaatchi turi tanlanishi shart' });
    }

    if (!category) {
      return res.status(400).json({ error: 'Murojaat yo‘nalishi tanlanishi shart' });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Murojaat mavzusi kiritilishi shart' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Murojaat matni kiritilishi shart' });
    }

    const appeals = loadAppeals();
    const newId = generateAppealId(appeals);
    const nowIso = new Date().toISOString();

    const newAppeal: Appeal = {
      id: newId,
      trackingCode: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : undefined,
      applicantType,
      category,
      subject: String(subject).trim(),
      content: String(content).trim(),
      attachment: attachment ? {
        name: String(attachment.name || 'fayl'),
        size: Number(attachment.size || 0),
        type: String(attachment.type || 'application/octet-stream'),
        dataUrl: attachment.dataUrl
      } : null,
      consent: true,
      status: 'Yangi',
      history: [
        {
          id: `h-${Date.now()}`,
          timestamp: nowIso,
          action: 'Murojaat yuborildi va ro‘yxatga olindi',
          status: 'Yangi',
          author: 'Murojaatchi'
        }
      ]
    };

    appeals.unshift(newAppeal);
    saveAppeals(appeals);

    return res.status(201).json({
      success: true,
      appealId: newId,
      message: 'Murojaatingiz muvaffaqiyatli qabul qilindi.',
      appeal: {
        id: newAppeal.id,
        fullName: newAppeal.fullName,
        phone: newAppeal.phone,
        category: newAppeal.category,
        subject: newAppeal.subject,
        status: newAppeal.status,
        createdAt: newAppeal.createdAt
      }
    });
  } catch (err: any) {
    console.error('Error submitting appeal:', err);
    return res.status(500).json({ error: 'Murojaatni saqlashda xatolik yuz berdi' });
  }
});

// 3. Check Appeal Status (Public by ID and Phone)
app.post('/api/appeals/check', (req: Request, res: Response) => {
  try {
    const { appealId, phone } = req.body;

    if (!appealId || !phone) {
      return res.status(400).json({ error: 'Murojaat ID raqami va telefon raqamingizni kiriting' });
    }

    const cleanId = String(appealId).trim().toUpperCase();
    const cleanPhone = normalizePhone(phone);

    const appeals = loadAppeals();
    const found = appeals.find(a => 
      a.id.toUpperCase() === cleanId && 
      normalizePhone(a.phone) === cleanPhone
    );

    if (!found) {
      return res.status(404).json({
        error: 'Murojaat topilmadi. Murojaat ID raqami va telefon raqami to‘g‘ri kiritilganligini tekshiring.'
      });
    }

    return res.json({
      success: true,
      appeal: {
        id: found.id,
        trackingCode: found.trackingCode,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
        fullName: found.fullName,
        phone: found.phone,
        email: found.email,
        applicantType: found.applicantType,
        category: found.category,
        subject: found.subject,
        content: found.content,
        attachmentName: found.attachment?.name,
        attachmentUrl: found.attachment?.dataUrl,
        status: found.status,
        assignedDepartment: found.assignedDepartment,
        assignedOfficer: found.assignedOfficer,
        deadline: found.deadline,
        officialResponse: found.officialResponse,
        responseAttachment: found.responseAttachment,
        history: found.history
      }
    });
  } catch (err: any) {
    console.error('Error checking appeal:', err);
    return res.status(500).json({ error: 'Murojaat holatini tekshirishda xatolik yuz berdi' });
  }
});

// 4. Real Stats (Public)
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const appeals = loadAppeals();
    const stats = computeRealStats(appeals);
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Statistika yuklanmadi' });
  }
});

// ================= ADMIN AUTH ROUTES =================

// 5. Admin Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Login va parolni kiriting' });
    }

    if (!fs.existsSync(ADMIN_FILE)) {
      initAdminCredentials();
    }

    const adminData = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));

    if (username !== adminData.username) {
      return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
    }

    const incomingHash = hashPassword(password, adminData.salt);
    if (incomingHash !== adminData.passwordHash) {
      return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
    }

    const token = `token_${crypto.randomBytes(32).toString('hex')}`;
    activeAdminTokens.add(token);

    return res.json({
      success: true,
      token,
      user: {
        username: adminData.username,
        name: 'Murojaatlar koordinatori',
        role: 'Administrator',
        branch: 'TKTI Yangiyer filiali'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Kirishda xatolik yuz berdi' });
  }
});

// 6. Admin Change Password
app.post('/api/admin/change-password', adminAuth, (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo‘lishi kerak' });
    }

    const adminData = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
    const currentHash = hashPassword(currentPassword, adminData.salt);

    if (currentHash !== adminData.passwordHash) {
      return res.status(400).json({ error: 'Joriy parol noto‘g‘ri' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ username: adminData.username, salt: newSalt, passwordHash: newHash }, null, 2),
      'utf8'
    );

    return res.json({ success: true, message: 'Parol muvaffaqiyatli o‘zgartirildi' });
  } catch (err) {
    return res.status(500).json({ error: 'Parolni o‘zgartirishda xatolik' });
  }
});

// ================= PROTECTED ADMIN ROUTES =================

// 7. Get Appeals List with Filters & Search
app.get('/api/admin/appeals', adminAuth, (req: Request, res: Response) => {
  try {
    const { status, category, applicantType, search, startDate, endDate } = req.query;
    let list = loadAppeals();

    if (status && status !== 'all') {
      list = list.filter(a => a.status === status);
    }

    if (category && category !== 'all') {
      list = list.filter(a => a.category === category);
    }

    if (applicantType && applicantType !== 'all') {
      list = list.filter(a => a.applicantType === applicantType);
    }

    if (startDate) {
      list = list.filter(a => new Date(a.createdAt) >= new Date(String(startDate)));
    }

    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      list = list.filter(a => new Date(a.createdAt) <= end);
    }

    if (search) {
      const q = String(search).toLowerCase();
      const qPhone = normalizePhone(q);
      list = list.filter(a => 
        a.id.toLowerCase().includes(q) ||
        a.fullName.toLowerCase().includes(q) ||
        a.subject.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (qPhone && normalizePhone(a.phone).includes(qPhone))
      );
    }

    return res.json({
      success: true,
      appeals: list,
      stats: computeRealStats(loadAppeals())
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Murojaatlar ro‘yxatini yuklashda xatolik' });
  }
});

// 8. Update Appeal (Status, Officer, Response, Internal Notes)
app.patch('/api/admin/appeals/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      assignedDepartment,
      assignedOfficer,
      deadline,
      officialResponse,
      responseAttachment,
      internalNotes,
      comment,
      author
    } = req.body;

    const appeals = loadAppeals();
    const index = appeals.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Murojaat topilmadi' });
    }

    const current = appeals[index];
    const prevStatus = current.status;
    const nowIso = new Date().toISOString();

    const actionText = status && status !== prevStatus
      ? `Holat o‘zgartirildi: ${prevStatus} ➔ ${status}`
      : (comment || 'Murojaat ma’lumotlari yangilandi');

    const historyEntry = {
      id: `h-${Date.now()}`,
      timestamp: nowIso,
      action: actionText,
      status: (status as AppealStatus) || current.status,
      comment: comment || (officialResponse ? 'Rasmiy javob tayyorlandi' : undefined),
      author: author || 'Administrator'
    };

    const updated: Appeal = {
      ...current,
      updatedAt: nowIso,
      status: status !== undefined ? status : current.status,
      assignedDepartment: assignedDepartment !== undefined ? assignedDepartment : current.assignedDepartment,
      assignedOfficer: assignedOfficer !== undefined ? assignedOfficer : current.assignedOfficer,
      deadline: deadline !== undefined ? deadline : current.deadline,
      officialResponse: officialResponse !== undefined ? officialResponse : current.officialResponse,
      responseAttachment: responseAttachment !== undefined ? responseAttachment : current.responseAttachment,
      internalNotes: internalNotes !== undefined ? internalNotes : current.internalNotes,
      history: [historyEntry, ...(current.history || [])]
    };

    appeals[index] = updated;
    saveAppeals(appeals);

    return res.json({
      success: true,
      message: 'Murojaat muvaffaqiyatli saqlandi',
      appeal: updated
    });
  } catch (err: any) {
    console.error('Error updating appeal:', err);
    return res.status(500).json({ error: 'Yangilashda xatolik yuz berdi' });
  }
});

// 9. Delete Appeal (Admin only)
app.delete('/api/admin/appeals/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let appeals = loadAppeals();
    const exists = appeals.some(a => a.id === id);
    if (!exists) {
      return res.status(404).json({ error: 'Murojaat topilmadi' });
    }
    appeals = appeals.filter(a => a.id !== id);
    saveAppeals(appeals);
    return res.json({ success: true, message: 'Murojaat o‘chirildi' });
  } catch (err) {
    return res.status(500).json({ error: 'Murojaatni o‘chirishda xatolik' });
  }
});

// 10. Update Branch Settings (Admin only)
app.put('/api/admin/settings', adminAuth, (req: Request, res: Response) => {
  try {
    const updated = req.body as BranchSettings;
    if (!updated || !updated.address || !updated.phonePrimary) {
      return res.status(400).json({ error: 'Manzil va asosiy telefon raqamini kiritish shart' });
    }
    saveSettings(updated);
    return res.json({ success: true, message: 'Filial aloqa ma’lumotlari saqlandi', settings: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik' });
  }
});

// 11. Export Appeals to Excel (.xlsx)
app.get('/api/admin/export/excel', adminAuth, (req: Request, res: Response) => {
  try {
    const appeals = loadAppeals();

    const rows = appeals.map((a, idx) => ({
      'T/r': idx + 1,
      'Murojaat ID': a.id,
      'Sana': new Date(a.createdAt).toLocaleString('uz-UZ'),
      'Murojaatchi F.I.Sh.': a.fullName,
      'Telefon raqami': a.phone,
      'E-pochta': a.email || '-',
      'Murojaatchi toifasi': a.applicantType,
      'Murojaat yo‘nalishi': a.category,
      'Mavzu': a.subject,
      'Murojaat matni': a.content,
      'Fayl biriktirilgan': a.attachment ? a.attachment.name : 'Yo‘q',
      'Holati': a.status,
      'Mas’ul bo‘lim': a.assignedDepartment || '-',
      'Mas’ul xodim': a.assignedOfficer || '-',
      'Ijro muddati': a.deadline || '-',
      'Rasmiy javob matni': a.officialResponse || '-',
      'Ichki izohlar': a.internalNotes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const columnWidths = [
      { wch: 6 },
      { wch: 18 },
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
      { wch: 28 },
      { wch: 32 },
      { wch: 50 },
      { wch: 20 },
      { wch: 22 },
      { wch: 32 },
      { wch: 28 },
      { wch: 16 },
      { wch: 50 },
      { wch: 35 }
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Murojaatlar');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TKTI_Yangiyer_Murojaatlar_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(buffer);
  } catch (err: any) {
    console.error('Error exporting to Excel:', err);
    return res.status(500).json({ error: 'Excel fayl yaratishda xatolik' });
  }
});

// 12. Backup Database (JSON)
app.get('/api/admin/backup', adminAuth, (_req: Request, res: Response) => {
  try {
    const appeals = loadAppeals();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TKTI_Murojaatlar_Backup_${new Date().toISOString().slice(0, 10)}.json"`
    );
    return res.send(JSON.stringify(appeals, null, 2));
  } catch (err) {
    return res.status(500).json({ error: 'Zaxira nusxasi yuklab olinmadi' });
  }
});

// 13. Restore Database (JSON)
app.post('/api/admin/restore', adminAuth, (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Noto‘g‘ri formatdagi ma’lumotlar' });
    }
    saveAppeals(data);
    return res.json({ success: true, count: data.length, message: 'Ma’lumotlar muvaffaqiyatli tiklandi' });
  } catch (err) {
    return res.status(500).json({ error: 'Tiklashda xatolik yuz berdi' });
  }
});

// Mount Vite or serve static dist
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TKTI Yangiyer Murojaatlar Portali running on http://localhost:${PORT}`);
  });
}

setupServer();
