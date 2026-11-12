import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Printer, 
  ChevronRight,
  FileText
} from 'lucide-react';
import { getStatusBadgeConfig } from '../utils/constants';
import type { Appeal, AppealStatus } from '../types/appeal';

interface CheckStatusSectionProps {
  initialAppealId?: string;
  initialPhone?: string;
  onGoToSubmit: () => void;
}

export const CheckStatusSection: React.FC<CheckStatusSectionProps> = ({
  initialAppealId = '',
  initialPhone = '',
  onGoToSubmit
}) => {
  const [appealId, setAppealId] = useState(initialAppealId);
  const [phone, setPhone] = useState(initialPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appealData, setAppealData] = useState<Appeal | null>(null);

  useEffect(() => {
    if (initialAppealId && initialPhone) {
      setAppealId(initialAppealId);
      setPhone(initialPhone);
      handleSearchWith(initialAppealId, initialPhone);
    }
  }, [initialAppealId, initialPhone]);

  const handleSearchWith = async (id: string, ph: string) => {
    setErrorMessage(null);

    const cleanId = id.trim().toUpperCase();
    const cleanPh = ph.trim();

    if (!cleanId || !cleanPh) {
      setErrorMessage('Murojaat ID raqami va telefon raqamingizni kiriting');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/appeals/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appealId: cleanId,
          phone: cleanPh
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Murojaat topilmadi');
      }

      setAppealData(data.appeal);
    } catch (err: any) {
      setErrorMessage(err.message || 'Murojaatni tekshirishda xatolik yuz berdi');
      setAppealData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearchWith(appealId, phone);
  };

  // 6 Stepper Stages
  const stages: { key: AppealStatus; label: string }[] = [
    { key: 'Yangi', label: '1. Yangi' },
    { key: 'Qabul qilindi', label: '2. Qabul qilindi' },
    { key: 'Ko‘rib chiqilmoqda', label: '3. Ko‘rib chiqilmoqda' },
    { key: 'Mas’ul xodimga yuborildi', label: '4. Mas’ul xodimga yuborildi' },
    { key: 'Javob tayyorlandi', label: '5. Javob tayyorlandi' },
    { key: 'Yakunlandi', label: '6. Yakunlandi' }
  ];

  const getStepIndex = (status: AppealStatus | string): number => {
    switch (status) {
      case 'Yangi': return 0;
      case 'Qabul qilindi': return 1;
      case 'Ko‘rib chiqilmoqda': return 2;
      case 'Mas’ul xodimga yuborildi':
      case 'Mas’ul bo‘limga yuborildi': return 3;
      case 'Javob tayyorlandi': return 4;
      case 'Yakunlandi': return 5;
      default: return 0;
    }
  };

  const currentStepIdx = appealData ? getStepIndex(appealData.status) : 0;

  return (
    <div className="py-8 sm:py-12 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Search Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#0f3b75] to-[#174b8c] px-6 py-6 sm:px-8 text-white">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Murojaat holatini tekshirish
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 mt-1">
              Murojaat yuborganingizda berilgan ID raqam va telefon raqamingizni kiriting.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="p-6 sm:p-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Murojaat ID raqami <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={appealId}
                  onChange={(e) => setAppealId(e.target.value.toUpperCase())}
                  placeholder="Masalan: TKTI-2026-0001"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0f3b75] text-sm font-mono uppercase bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Telefon raqamingiz <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0f3b75] text-sm bg-white text-slate-900"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Begona shaxslar arizangizni ko‘ra olmaydi.
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{errorMessage}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0f3b75] hover:bg-[#164685] text-white font-bold rounded-xl shadow-md transition-colors text-xs sm:text-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Tekshirilmoqda...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Tekshirish</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Found Appeal Details */}
        {appealData && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden space-y-6">
            <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Murojaat raqami:
                  </span>
                  <span className="text-xl font-mono font-extrabold text-[#0f3b75]">
                    {appealData.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Sana: {new Date(appealData.createdAt).toLocaleString('uz-UZ')}
                </div>
              </div>

              <div>
                {(() => {
                  const cfg = getStatusBadgeConfig(appealData.status);
                  return (
                    <span
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                      <span>{appealData.status}</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Stepper */}
            <div className="px-6 py-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Ijro bosqichlari
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {stages.map((st, idx) => {
                  const isDone = idx < currentStepIdx || (idx === currentStepIdx && appealData.status === 'Yakunlandi');
                  const isCurrent = idx === currentStepIdx && appealData.status !== 'Yakunlandi';

                  return (
                    <div
                      key={st.key}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : isCurrent
                          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 text-[#0f3b75] font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold">
                          {isDone ? 'Bajarildi' : isCurrent ? 'Jarayonda' : `Bosqich ${idx + 1}`}
                        </span>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : isCurrent ? (
                          <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-slate-300"></div>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 text-[11px] leading-tight">
                        {st.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Official Response if any */}
            {appealData.officialResponse && (
              <div className="mx-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">
                      TKTI Rasmiy Javob
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      Mas’ul: {appealData.assignedOfficer || appealData.assignedDepartment || 'Filial rahbariyati'}
                    </span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-emerald-100">
                  {appealData.officialResponse}
                </div>

                {appealData.responseAttachment?.dataUrl && (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-emerald-200 rounded-xl text-xs">
                    <span className="font-medium text-slate-800">
                      {appealData.responseAttachment.name}
                    </span>
                    <a
                      href={appealData.responseAttachment.dataUrl}
                      download={appealData.responseAttachment.name}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                    >
                      <Download className="w-3 h-3" />
                      <span>Yuklab olish</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Appeal Text & Info */}
            <div className="px-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Murojaatchi:</span>
                  <strong className="text-slate-900">{appealData.fullName}</strong> ({appealData.applicantType})
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Yo‘nalish:</span>
                  <strong className="text-slate-900">{appealData.category}</strong>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1">
                <span className="text-xs text-slate-500 font-bold block">Mavzu:</span>
                <div className="font-bold text-slate-900">{appealData.subject}</div>
                <span className="text-xs text-slate-500 font-bold block pt-2">Murojaat matni:</span>
                <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                  {appealData.content}
                </p>
              </div>
            </div>

            {/* History */}
            {appealData.history && appealData.history.length > 0 && (
              <div className="px-6 pb-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Amallar tarixi
                </h4>
                <div className="space-y-2">
                  {appealData.history.map((h, i) => (
                    <div key={h.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-800">{h.action}</strong>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.timestamp).toLocaleString('uz-UZ')}
                        </span>
                      </div>
                      {h.comment && <div className="text-slate-600 mt-0.5">{h.comment}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="p-5 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors no-print cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Chop etish</span>
              </button>

              <button
                onClick={onGoToSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f3b75] hover:bg-[#154685] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <span>Yangi murojaat yuborish</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
