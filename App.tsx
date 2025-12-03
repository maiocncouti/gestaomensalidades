
import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Users, Calendar, CreditCard, Settings as SettingsIcon, 
  MessageCircle, BarChart2, Plus, Trash2, Edit2, 
  Check, AlertTriangle, Key, Save, Upload, Download,
  Menu, X, DollarSign, Image as ImageIcon, Camera, Lock, Clock, AlertOctagon, MessageSquare, Briefcase, ChevronDown, ChevronUp, ChevronRight, Calendar as CalendarIcon, FileText, Phone, UserPlus, Crown, Star, Award, Cake, QrCode, Search, Filter, Monitor, ArrowRight, ShieldCheck, Zap, Globe
} from 'lucide-react';
import { AppData, Client, Plan, Settings, MessageTemplate, ViewState, AccountPayable, AccountInstallment } from './types';
import { SPLASH_IMAGE, SUPPORT_IMAGE, SUPPORT_PHONE, SUPPORT_EMAIL, DAILY_KEYS, ANNUAL_KEYS, LIFETIME_KEYS, DEFAULT_TEMPLATES, TRANSLATIONS } from './constants';

// --- Helpers ---

const parseLocalDate = (dateStr: string | undefined) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const crc16ccitt = (str: string) => {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  if (hex.length < 4) hex = "0".repeat(4 - hex.length) + hex;
  return hex;
};

const generatePix = (key: string, name: string, city: string = 'BRASIL', amount: number, txId: string = '***') => {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const payload = [
    formatField('00', '01'), 
    formatField('26', `0014br.gov.bcb.pix01${key.length.toString().padStart(2, '0')}${key}`), 
    formatField('52', '0000'), 
    formatField('53', '986'), 
    formatField('54', amount.toFixed(2)), 
    formatField('58', 'BR'), 
    formatField('59', name.substring(0, 25).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")), 
    formatField('60', city.substring(0, 15).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")), 
    formatField('62', formatField('05', txId)) 
  ].join('');

  const crcPayload = `${payload}6304`;
  const crc = crc16ccitt(crcPayload);
  return `${crcPayload}${crc}`;
};

// --- Context ---

const INITIAL_DATA: AppData = {
  clients: [],
  plans: [],
  accountsPayable: [],
  settings: {
    companyName: 'Pocket Plan Manager',
    ownerName: '',
    document: '',
    otherInfo: '',
    profileImage: SPLASH_IMAGE,
    supportImage: SUPPORT_IMAGE,
    dashboardAlertDays: 3, 
    dashboardShowClientAlerts: true,
    dashboardUrgentDays: 3,
    dashboardShowBirthdays: true,
    dashboardBirthdayDays: 0,
    dashboardShowAccounts: true,
    dashboardAccountsDays: 1,
    dashboardShowPaymentMonitoring: true,
    pixName: '',
    pixKeyType: 'email',
    pixKey: '',
    language: 'pt',
    installDate: new Date().toISOString()
  },
  license: {
    isActive: false,
    expirationDate: new Date().toISOString(),
    usedKeys: []
  },
  messageTemplates: DEFAULT_TEMPLATES
};

const AppContext = createContext<{
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (plan: Plan) => void;
  deletePlan: (id: string) => void;
  addAccount: (account: AccountPayable) => void;
  deleteAccount: (id: string) => void;
  updateAccount: (account: AccountPayable) => void;
  saveSettings: (settings: Settings) => void;
  activateLicense: (key: string) => 'success' | 'invalid' | 'duplicate';
  addMessageTemplate: (template: MessageTemplate) => void;
  navigate: (view: ViewState) => void;
  currentView: ViewState;
  isLicenseValid: boolean;
  t: (key: keyof typeof TRANSLATIONS['pt'], params?: Record<string, any>) => string;
}>({
  data: INITIAL_DATA,
  setData: () => {},
  addClient: () => {},
  updateClient: () => {},
  deleteClient: () => {},
  addPlan: () => {},
  updatePlan: () => {},
  deletePlan: () => {},
  addAccount: () => {},
  deleteAccount: () => {},
  updateAccount: () => {},
  saveSettings: () => {},
  activateLicense: () => 'invalid',
  addMessageTemplate: () => {},
  navigate: () => {},
  currentView: 'dashboard',
  isLicenseValid: false,
  t: (key) => key
});

const AppProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('iptv_manager_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure installDate exists for existing users
      if (!parsed.settings.installDate) {
        parsed.settings.installDate = new Date().toISOString();
      }
      return parsed;
    }
    return INITIAL_DATA;
  });
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  useEffect(() => {
    localStorage.setItem('iptv_manager_data', JSON.stringify(data));
  }, [data]);

  const isLicenseValid = React.useMemo(() => {
    if (!data.license.isActive) return false;
    const now = new Date();
    const exp = new Date(data.license.expirationDate);
    return exp > now;
  }, [data.license]);

  const t = (key: keyof typeof TRANSLATIONS['pt'], params: Record<string, any> = {}) => {
    const lang = data.settings.language || 'pt';
    let text = TRANSLATIONS[lang][key] || TRANSLATIONS['pt'][key] || key;
    Object.keys(params).forEach(k => {
      text = text.replace(`{${k}}`, params[k]);
    });
    return text;
  };

  const addClient = (client: Client) => setData(p => ({ ...p, clients: [...p.clients, client] }));
  const updateClient = (client: Client) => setData(p => ({ ...p, clients: p.clients.map(c => c.id === client.id ? client : c) }));
  const deleteClient = (id: string) => setData(p => ({ ...p, clients: p.clients.filter(c => c.id !== id) }));
  const addPlan = (plan: Plan) => setData(p => ({ ...p, plans: [...p.plans, plan] }));
  const updatePlan = (plan: Plan) => setData(p => ({ ...p, plans: p.plans.map(pl => pl.id === plan.id ? plan : pl) }));
  const deletePlan = (id: string) => setData(p => ({ ...p, plans: p.plans.filter(pl => pl.id !== id) }));
  const addAccount = (acc: AccountPayable) => setData(p => ({ ...p, accountsPayable: [...p.accountsPayable, acc] }));
  const updateAccount = (acc: AccountPayable) => setData(p => ({ ...p, accountsPayable: p.accountsPayable.map(a => a.id === acc.id ? acc : a) }));
  const deleteAccount = (id: string) => setData(p => ({ ...p, accountsPayable: p.accountsPayable.filter(a => a.id !== id) }));
  const saveSettings = (st: Settings) => setData(p => ({ ...p, settings: st }));
  const addMessageTemplate = (t: MessageTemplate) => setData(p => ({ ...p, messageTemplates: [...p.messageTemplates, t] }));

  const activateLicense = (inputKey: string) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateKey = `${day}/${month}`;
    
    const validDailyKey = DAILY_KEYS[dateKey];
    if (inputKey === validDailyKey) {
      if (data.license.usedKeys?.some(k => k.key === inputKey && k.year === currentYear)) return 'duplicate';
      const currentExp = new Date(data.license.expirationDate);
      const baseDate = data.license.isActive && currentExp > today ? currentExp : today;
      const newExp = new Date(baseDate);
      newExp.setDate(newExp.getDate() + 30);
      setData(prev => ({ ...prev, license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: [...(prev.license.usedKeys || []), { key: inputKey, year: currentYear }] } }));
      return 'success';
    }

    if (Object.values(ANNUAL_KEYS).includes(inputKey)) {
       if (data.license.usedKeys?.some(k => k.key === inputKey)) return 'duplicate';
       const currentExp = new Date(data.license.expirationDate);
       const baseDate = data.license.isActive && currentExp > today ? currentExp : today;
       const newExp = new Date(baseDate);
       newExp.setDate(newExp.getDate() + 365);
       setData(prev => ({ ...prev, license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: [...(prev.license.usedKeys || []), { key: inputKey, year: currentYear }] } }));
       return 'success';
    }

    if (Object.values(LIFETIME_KEYS).includes(inputKey)) {
       if (data.license.usedKeys?.some(k => k.key === inputKey)) return 'duplicate';
       const newExp = new Date(today);
       newExp.setFullYear(newExp.getFullYear() + 100);
       setData(prev => ({ ...prev, license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: [...(prev.license.usedKeys || []), { key: inputKey, year: currentYear }] } }));
       return 'success';
    }

    return 'invalid';
  };

  return (
    <AppContext.Provider value={{
      data, setData, addClient, updateClient, deleteClient,
      addPlan, updatePlan, deletePlan, saveSettings, activateLicense,
      navigate: setCurrentView, currentView, isLicenseValid,
      addMessageTemplate, addAccount, deleteAccount, updateAccount, t
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- Components ---

const PaymentModal = ({ isOpen, onClose, onConfirm, totalValue, title }: any) => {
  const { t } = useContext(AppContext);
  const [amount, setAmount] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <p className="mb-4 text-gray-600">{t('totalValue')}: R$ {totalValue.toFixed(2)}</p>
        <div className="space-y-3">
          <button onClick={() => onConfirm('total')} className="w-full bg-green-600 text-white p-3 rounded font-bold">{t('payTotal')} (R$ {totalValue.toFixed(2)})</button>
          <div className="border-t pt-3">
            <p className="text-sm font-semibold mb-2">{t('payPartial')}:</p>
            <div className="flex space-x-2">
              <span className="p-2 bg-gray-100 border border-r-0 rounded-l">R$</span>
              <input type="number" className="w-full p-2 border rounded-r" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <button onClick={() => { if(Number(amount) > 0) onConfirm('partial', Number(amount)); }} className="w-full bg-blue-600 text-white p-3 rounded font-bold mt-2" disabled={!amount || Number(amount) <= 0}>{t('confirmPartial')}</button>
          </div>
          <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-2">{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const ChargeModal = ({ isOpen, onClose, client, plan, settings }: any) => {
  const { t } = useContext(AppContext);
  if (!isOpen || !client) return null;
  const amount = client.amountOwed ?? (plan?.price || 0);
  const pixCode = settings.pixKey ? generatePix(settings.pixKey, settings.pixName || settings.companyName, 'BRASIL', amount) : '';
  
  const handleShare = () => {
    const text = `Olá ${client.name}!\nSeguem dados para pagamento:\nValor: R$ ${amount.toFixed(2)}\n\nChave Pix: ${settings.pixKey}\n\nCódigo Copia e Cola:\n${pixCode}`;
    window.open(`https://wa.me/${client.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center">
        <h3 className="text-lg font-bold mb-2">{t('pixCharge')}</h3>
        <p className="text-sm text-gray-600 mb-4">{client.name}</p>
        <div className="text-3xl font-bold text-brand-blue mb-4">R$ {amount.toFixed(2)}</div>
        {pixCode ? (
          <>
             <div className="bg-gray-100 p-4 rounded mb-4 break-all text-xs font-mono">{pixCode}</div>
             <button onClick={handleShare} className="w-full bg-green-600 text-white p-3 rounded font-bold flex items-center justify-center mb-2"><MessageCircle size={18} className="mr-2" /> {t('sendWhatsApp')}</button>
             <button onClick={() => navigator.clipboard.writeText(pixCode)} className="w-full bg-blue-100 text-blue-700 p-3 rounded font-bold">{t('copyCode')}</button>
          </>
        ) : (
          <p className="text-red-500 text-sm">Configure a chave Pix nas configurações para gerar o QR Code.</p>
        )}
        <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-4">{t('close')}</button>
      </div>
    </div>
  );
};

const SearchFilterBar = ({ searchTerm, setSearchTerm, filterValue, setFilterValue, filterOptions, placeholder }: any) => (
  <div className="flex flex-col md:flex-row gap-2 mb-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      <input className="w-full pl-10 p-2 border rounded" placeholder={placeholder} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
    </div>
    {filterOptions && (
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <select className="pl-10 p-2 border rounded bg-white w-full md:w-auto" value={filterValue} onChange={e => setFilterValue(e.target.value)}>
          {filterOptions.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )}
  </div>
);

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const { data, t } = useContext(AppContext);
  useEffect(() => { setTimeout(onFinish, 5000); }, [onFinish]);
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-4">
      <img src={data.settings.profileImage || SPLASH_IMAGE} alt="Splash" className="w-full max-w-md object-contain rounded-lg shadow-2xl mb-8 animate-fade-in" />
      <h1 className="text-2xl font-bold text-brand-blue animate-pulse">{t('loading')}</h1>
    </div>
  );
};

// --- Views ---

const Dashboard = () => {
  const { data, isLicenseValid, t, updateClient } = useContext(AppContext);
  const { clients, accountsPayable, settings } = data;
  const [paymentFilter, setPaymentFilter] = useState<'today' | '7days' | '30days' | 'overdue'>('overdue');
  const [monitoringModal, setMonitoringModal] = useState<Client | null>(null);
  const [showMsgModal, setShowMsgModal] = useState<Client | null>(null);
  const [showPayModal, setShowPayModal] = useState<Client | null>(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showUrgentList, setShowUrgentList] = useState(false);
  const [showUrgentAccountsList, setShowUrgentAccountsList] = useState(false);

  // Trial Logic
  const installDate = new Date(data.settings.installDate || new Date());
  const isTrialExpired = (new Date().getTime() - installDate.getTime()) > (3 * 86400000); // 3 days in ms

  const today = new Date(); today.setHours(0,0,0,0);
  
  const receivables = clients.reduce((acc, client) => {
    if (client.paymentStatus === 'paid') return acc;
    const targetDate = parseLocalDate(client.paymentDate || client.dueDate);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (86400000));
    if (diffDays >= 0 && diffDays <= settings.dashboardAlertDays) {
      const plan = data.plans.find(p => p.id === client.planId);
      return acc + (client.amountOwed ?? (plan?.price || 0));
    }
    return acc;
  }, 0);

  const urgentDays = settings.dashboardUrgentDays || 1;
  const urgentClients = clients.filter(c => {
    const due = parseLocalDate(c.dueDate);
    if(c.dueTime) { const [h,m] = c.dueTime.split(':'); due.setHours(Number(h), Number(m)); } 
    else due.setHours(23,59,59);
    const diff = due.getTime() - new Date().getTime();
    return diff > 0 && diff <= (urgentDays * 86400000);
  });

  const accountsUrgentDays = settings.dashboardAccountsDays || 1;
  const urgentAccounts = accountsPayable.filter(acc => {
    return acc.installments.some(inst => {
      if (inst.status === 'paid') return false;
      const due = parseLocalDate(inst.dueDate);
      const diff = due.getTime() - new Date().getTime();
      return diff > 0 && diff <= (accountsUrgentDays * 86400000);
    });
  });

  const filteredPaymentClients = clients.filter(client => {
    if (client.paymentStatus === 'paid') return false;
    const targetDate = parseLocalDate(client.paymentDate || client.dueDate);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
    if (paymentFilter === 'overdue') return diffDays < 0;
    if (paymentFilter === 'today') return diffDays === 0;
    if (paymentFilter === '7days') return diffDays > 0 && diffDays <= 7;
    return diffDays > 0 && diffDays <= 30;
  });

  // Block Dashboard Features if Trial Expired and No License
  if (!isLicenseValid && isTrialExpired) {
    return (
      <div className="p-4 space-y-4 pb-20 md:pb-4">
        <div className="flex items-center space-x-4 mb-6">
          <img src={data.settings.profileImage} alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-brand-blue" />
          <h1 className="text-2xl font-bold text-brand-blue">{data.settings.companyName}</h1>
        </div>
        <div className="bg-red-100 border-l-4 border-red-600 p-6 rounded-lg shadow-lg">
           <div className="flex items-center mb-4">
             <Lock size={32} className="text-red-600 mr-3"/>
             <h2 className="text-xl font-bold text-red-700">Acesso Restrito</h2>
           </div>
           <p className="text-red-800 font-bold text-lg">{t('trialExpiredMsg')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-20 md:pb-4">
      <div className="flex items-center space-x-4 mb-6">
        <img src={data.settings.profileImage} alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-brand-blue" />
        <h1 className="text-2xl font-bold text-brand-blue">{data.settings.companyName}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex justify-between items-center"><h3 className="text-gray-500 text-sm font-medium">{t('receivables', { days: settings.dashboardAlertDays })}</h3><DollarSign className="text-green-500" size={20} /></div>
          <p className="text-2xl font-bold mt-2">R$ {receivables.toFixed(2)}</p>
        </div>
        {settings.dashboardShowClientAlerts && (
         <div 
            onClick={() => { if(urgentClients.length > 0) setShowUrgentList(true); }}
            className={`bg-white p-4 rounded-lg shadow border-l-4 border-red-500 cursor-pointer ${urgentClients.length > 0 ? 'animate-pulse ring-2 ring-red-300' : ''}`}
         >
          <div className="flex justify-between items-center">
            <h3 className="text-red-600 text-sm font-bold">{urgentDays === 1 ? t('urgent24h') : t('urgentDays', {days: urgentDays})}</h3>
            <Clock className="text-red-500" size={20} />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-700">{urgentClients.length} {t('clients')}</p>
        </div>
        )}
        {settings.dashboardShowAccounts && (
         <div 
            onClick={() => { if(urgentAccounts.length > 0) setShowUrgentAccountsList(true); }}
            className={`bg-white p-4 rounded-lg shadow border-l-4 border-red-500 cursor-pointer ${urgentAccounts.length > 0 ? 'animate-pulse ring-2 ring-red-300' : ''}`}
         >
          <div className="flex justify-between items-center">
            <h3 className="text-red-600 text-sm font-bold">{accountsUrgentDays === 1 ? t('accountsUrgent24h') : t('accountsUrgentDays', {days: accountsUrgentDays})}</h3>
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-700">{urgentAccounts.length}</p>
        </div>
        )}
      </div>

      {settings.dashboardShowPaymentMonitoring && (
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800 flex items-center"><Monitor className="mr-2" size={20}/> {t('clientsMonitoring')}</h3>
            <select className="p-2 border rounded text-sm bg-gray-50" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as any)}>
              <option value="overdue">{t('overdueDebts')}</option>
              <option value="today">{t('dueToday')}</option>
              <option value="7days">{t('next7Days')}</option>
              <option value="30days">{t('next30Days')}</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">{t('client')}</th><th className="p-3">{t('value')}</th><th className="p-3">{t('paymentDate')}</th><th className="p-3">Ação</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPaymentClients.map(client => {
                  const diff = Math.ceil((parseLocalDate(client.paymentDate || client.dueDate).getTime() - today.getTime())/86400000);
                  const style = diff < 0 ? "text-red-600 animate-pulse font-bold" : diff === 0 ? "text-orange-500 font-bold" : "text-green-600 font-bold";
                  return (
                    <tr key={client.id} className="cursor-pointer hover:bg-gray-50">
                      <td className={`p-3 ${style}`} onClick={() => { setMonitoringModal(client); setShowPaymentHistory(false); }}>{client.name}</td>
                      <td className="p-3">R$ {(client.amountOwed ?? 0).toFixed(2)}</td>
                      <td className="p-3">{parseLocalDate(client.paymentDate || client.dueDate).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        <button onClick={(e) => { e.stopPropagation(); setMonitoringModal(client); setShowPaymentHistory(false); }} className="bg-brand-blue text-white text-xs px-2 py-1 rounded">
                           {t('charge')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {monitoringModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4 text-center">Detalhes da Cobrança</h3>
              {!showPaymentHistory ? (
                <>
                  <p className="mb-2"><strong>Nome:</strong> {monitoringModal.name}</p>
                  <p className="mb-2"><strong>Status:</strong> <span className="text-red-600 font-bold">Devendo</span></p>
                  <p className="mb-4"><strong>Data Pagamento (Previsão):</strong> {parseLocalDate(monitoringModal.paymentDate || monitoringModal.dueDate).toLocaleDateString()}</p>
                  
                  <button onClick={() => { setShowMsgModal(monitoringModal); setMonitoringModal(null); }} className="w-full bg-green-600 text-white p-3 rounded font-bold mb-3 flex items-center justify-center">
                     <MessageCircle className="mr-2" /> Enviar WhatsApp
                  </button>
                  <button onClick={() => { setShowPayModal(monitoringModal); setMonitoringModal(null); }} className="w-full bg-blue-600 text-white p-3 rounded font-bold mb-3 flex items-center justify-center">
                     <CreditCard className="mr-2" /> Realizar Pagamento
                  </button>
                   <button onClick={() => setShowPaymentHistory(true)} className="w-full bg-indigo-50 text-indigo-700 p-3 rounded font-bold mb-3 border border-indigo-100">
                     Todos os Pagamentos
                  </button>
                </>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                   <h4 className="font-bold mb-2 text-sm text-gray-500">Histórico de Pagamentos</h4>
                   {monitoringModal.paymentHistory && monitoringModal.paymentHistory.length > 0 ? (
                      <ul className="space-y-2 text-sm">
                         {monitoringModal.paymentHistory.map((h, i) => (
                           <li key={i} className="bg-green-50 p-2 rounded flex justify-between border border-green-100">
                             <span>{new Date(h.date).toLocaleDateString()}</span>
                             <span className="font-bold text-green-700">R$ {h.amount.toFixed(2)}</span>
                           </li>
                         ))}
                      </ul>
                   ) : (
                     <p className="text-sm text-gray-400 italic text-center py-4">Nenhum pagamento registrado.</p>
                   )}
                   <button onClick={() => setShowPaymentHistory(false)} className="w-full bg-gray-100 text-gray-700 p-2 rounded font-bold mt-4 text-sm">Voltar</button>
                </div>
              )}
              
              <button onClick={() => setMonitoringModal(null)} className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-4">
                 {t('close')}
              </button>
           </div>
        </div>
      )}

      {/* Message Modal Reused */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">{t('sendMessage')}</h3>
              <p className="text-gray-600 mb-4">{t('client')}: {showMsgModal.name}</p>
              <button onClick={() => { window.open(`https://wa.me/${showMsgModal.whatsapp}`, '_blank'); setShowMsgModal(null); }} className="w-full bg-green-600 text-white p-3 rounded font-bold mb-2 flex justify-center items-center"><MessageCircle className="mr-2"/> {t('writePersonalized')}</button>
              <button onClick={() => { 
                const templates = data.messageTemplates;
                if(templates.length === 0) alert("Nenhum modelo cadastrado.");
                else {
                   const t = templates[0];
                   let text = t.content.replace('{nome}', showMsgModal.name).replace('{data}', parseLocalDate(showMsgModal.dueDate).toLocaleDateString());
                   window.open(`https://wa.me/${showMsgModal.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
                   setShowMsgModal(null);
                }
              }} className="w-full bg-blue-600 text-white p-3 rounded font-bold mb-2 flex justify-center items-center"><FileText className="mr-2"/> {t('useTemplate')}</button>
              <button onClick={() => setShowMsgModal(null)} className="w-full bg-gray-200 text-gray-800 p-3 rounded">{t('cancel')}</button>
           </div>
        </div>
      )}

      {/* Payment Modal Reused */}
      <PaymentModal isOpen={!!showPayModal} onClose={() => setShowPayModal(null)} totalValue={showPayModal?.amountOwed || 0} title={`${t('payAccount')} - ${showPayModal?.name}`} onConfirm={(type: any, amount: any) => {
         const paidAmount = type === 'total' ? showPayModal!.amountOwed || 0 : amount;
         const newHistory = [...(showPayModal!.paymentHistory || []), { date: new Date().toISOString(), amount: paidAmount }];
         
         if (type === 'total') updateClient({...showPayModal!, paymentStatus: 'paid', amountOwed: 0, paymentHistory: newHistory});
         else updateClient({...showPayModal!, amountOwed: (showPayModal!.amountOwed || 0) - amount, paymentHistory: newHistory});
         setShowPayModal(null);
      }} />

      {/* Urgent List Modal - Clients */}
      {showUrgentList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg p-6 w-full max-w-sm max-h-[80vh] flex flex-col">
              <h3 className="font-bold text-lg mb-4 text-red-600">{t('clientAlerts')} ({urgentClients.length})</h3>
              <div className="overflow-y-auto flex-1 space-y-3">
                 {urgentClients.map(c => (
                    <div key={c.id} className="bg-red-50 p-3 rounded border border-red-100">
                       <p className="font-bold">{c.name}</p>
                       <p className="text-xs text-gray-600 mb-2">{t('planDue')}: {parseLocalDate(c.dueDate).toLocaleDateString()}</p>
                       <button onClick={() => { setShowMsgModal(c); setShowUrgentList(false); }} className="w-full bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center hover:bg-green-600">
                          <MessageCircle size={14} className="mr-1"/> {t('renewMessage')}
                       </button>
                    </div>
                 ))}
              </div>
              <button onClick={() => setShowUrgentList(false)} className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-4">{t('close')}</button>
           </div>
        </div>
      )}

      {/* Urgent List Modal - Accounts */}
      {showUrgentAccountsList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg p-6 w-full max-w-sm max-h-[80vh] flex flex-col">
              <h3 className="font-bold text-lg mb-4 text-red-600">{t('accountsPayable')} ({urgentAccounts.length})</h3>
              <div className="overflow-y-auto flex-1 space-y-2">
                 {urgentAccounts.map(acc => {
                    const urgentInstallments = acc.installments.filter(i => {
                       const due = parseLocalDate(i.dueDate);
                       const diff = due.getTime() - new Date().getTime();
                       return i.status === 'pending' && diff > 0 && diff <= (accountsUrgentDays * 86400000);
                    });
                    return urgentInstallments.map(inst => (
                       <div key={`${acc.id}-${inst.id}`} className="bg-red-50 p-2 rounded border border-red-100">
                          <p className="font-bold">{acc.name}</p>
                          <p className="text-xs text-gray-600">{t('installments')} {inst.number}: {parseLocalDate(inst.dueDate).toLocaleDateString()} - R$ {inst.value.toFixed(2)}</p>
                       </div>
                    ));
                 })}
              </div>
              <button onClick={() => setShowUrgentAccountsList(false)} className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-4">{t('close')}</button>
           </div>
        </div>
      )}

    </div>
  );
};

const ClientList = () => {
  const { data, addClient, updateClient, deleteClient, isLicenseValid, addPlan, t } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [newInlinePlan, setNewInlinePlan] = useState({ name: '', price: '' });
  const [messageModal, setMessageModal] = useState<{isOpen: boolean, client: Client | null}>({isOpen: false, client: null});

  const todayStr = new Date().toISOString().split('T')[0];
  const filtered = data.clients.filter(c => 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.whatsapp.includes(searchTerm)) && 
    (filterPlan === 'all' || c.planId === filterPlan)
  );

  const handleAddNew = () => {
    setEditingClient({ paymentStatus: 'pending', dueDate: todayStr, paymentDate: todayStr });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSave = (createAnother = false) => {
    const missing = [];
    if (!editingClient.name) missing.push(t('fullName'));
    if (!editingClient.whatsapp) missing.push(t('whatsapp'));
    let pid = editingClient.planId, amount = 0;
    if (pid === 'new_plan') {
       if (!newInlinePlan.name || !newInlinePlan.price) missing.push(t('newPlanTitle'));
    } else if (!pid) missing.push(t('selectPlan'));
    if (!editingClient.dueDate) missing.push(t('planDue'));
    if (editingClient.paymentStatus === 'pending' && !editingClient.paymentDate) missing.push(t('paymentDatePrediction'));
    
    if (missing.length > 0) { alert(t('missingFields', { fields: missing.join(', ') })); return; }

    if (pid === 'new_plan') {
       const newPlan: Plan = { id: Date.now().toString(), name: newInlinePlan.name, price: Number(newInlinePlan.price), description: '' };
       addPlan(newPlan);
       pid = newPlan.id;
       amount = newPlan.price;
    } else {
       const p = data.plans.find(pl => pl.id === pid);
       amount = p ? p.price : 0;
    }

    const clientData: Client = {
      id: editingClient.id || Date.now().toString(),
      name: editingClient.name!,
      whatsapp: editingClient.whatsapp!,
      planId: pid!,
      dueDate: editingClient.dueDate!,
      dueTime: editingClient.dueTime,
      paymentDate: editingClient.paymentDate,
      birthDate: editingClient.birthDate || '',
      paymentStatus: editingClient.paymentStatus || 'pending',
      profileImage: editingClient.profileImage,
      notes: editingClient.notes || '',
      createdAt: editingClient.createdAt || todayStr,
      amountOwed: editingClient.amountOwed !== undefined && pid !== 'new_plan' ? editingClient.amountOwed : amount,
      paymentHistory: editingClient.paymentHistory || []
    };

    if (isEditing) { updateClient(clientData); setShowForm(false); }
    else { addClient(clientData); if (createAnother) { setEditingClient({paymentStatus: 'pending', dueDate: todayStr, paymentDate: todayStr}); setNewInlinePlan({name:'',price:''}); } else setShowForm(false); }
  };

  const handleImportContact = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
       try {
         const contacts = await (navigator as any).contacts.select(['name', 'tel', 'icon'], {multiple: false});
         if(contacts.length) {
            setEditingClient(p => ({...p, name: contacts[0].name?.[0] || p.name, whatsapp: contacts[0].tel?.[0]?.replace(/\D/g,'') || p.whatsapp}));
            if(contacts[0].icon?.[0]) {
               const r = new FileReader(); r.onload = e => setEditingClient(p => ({...p, profileImage: e.target?.result as string})); r.readAsDataURL(contacts[0].icon[0]);
            }
         }
       } catch(e) { console.error(e); }
    } else alert("Não suportado.");
  };

  if (showForm) {
    return (
      <div className="p-4 pb-20 md:pb-4">
        <h2 className="text-xl font-bold mb-4">{isEditing ? t('editClient') : t('newClient')}</h2>
        <div className="bg-white p-4 rounded shadow space-y-4">
          <div className="flex flex-col items-center mb-4">
             <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mb-2 relative">
               {editingClient.profileImage ? <img src={editingClient.profileImage} className="w-full h-full object-cover"/> : <Users size={32}/>}
               <input type="file" accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>setEditingClient(p=>({...p, profileImage: r.result as string})); r.readAsDataURL(f); } }} className="absolute inset-0 opacity-0 cursor-pointer"/>
             </div>
             <span className="text-xs text-blue-600">{t('touchToChange')}</span>
          </div>
          <button onClick={handleImportContact} className="w-full bg-blue-50 text-blue-600 border border-blue-200 p-2 rounded flex items-center justify-center font-semibold"><UserPlus size={18} className="mr-2"/> {t('importContact')}</button>
          
          <input className="w-full p-2 border rounded" placeholder={`${t('fullName')} *`} value={editingClient.name||''} onChange={e=>setEditingClient({...editingClient, name:e.target.value})} />
          <input className="w-full p-2 border rounded" placeholder={`${t('whatsapp')} *`} value={editingClient.whatsapp||''} onChange={e=>setEditingClient({...editingClient, whatsapp:e.target.value})} />
          
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">{t('birthDate')}</label><input type="date" className="w-full p-2 border rounded" value={editingClient.birthDate||''} onChange={e=>setEditingClient({...editingClient, birthDate:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">{t('status')}</label><select className="w-full p-2 border rounded" value={editingClient.paymentStatus||'pending'} onChange={e=>setEditingClient({...editingClient, paymentStatus:e.target.value as any})}><option value="pending">{t('toPay')}</option><option value="paid">{t('paid')}</option></select></div>
          </div>

          {editingClient.paymentStatus === 'pending' && (
             <div><label className="text-xs text-gray-500">{t('paymentDatePrediction')} *</label><input type="date" className="w-full p-2 border rounded" value={editingClient.paymentDate||''} onChange={e=>setEditingClient({...editingClient, paymentDate:e.target.value})} /></div>
          )}

          <select className="w-full p-2 border rounded" value={editingClient.planId||''} onChange={e=>setEditingClient({...editingClient, planId:e.target.value})}>
             <option value="">{t('selectPlan')} *</option>
             {data.plans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.price}</option>)}
             <option value="new_plan" className="text-blue-600 font-bold">{t('newPlan')}</option>
          </select>
          {editingClient.planId === 'new_plan' && (
             <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <input className="w-full p-2 border rounded mb-2" placeholder={t('planNamePlaceholder')} value={newInlinePlan.name} onChange={e=>setNewInlinePlan({...newInlinePlan, name:e.target.value})}/>
                <input type="number" className="w-full p-2 border rounded" placeholder={t('planPricePlaceholder')} value={newInlinePlan.price} onChange={e=>setNewInlinePlan({...newInlinePlan, price:e.target.value})}/>
             </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">{t('planDue')} *</label><input type="date" className="w-full p-2 border rounded" value={editingClient.dueDate||''} onChange={e=>setEditingClient({...editingClient, dueDate:e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">{t('time')}</label><input type="time" className="w-full p-2 border rounded" value={editingClient.dueTime||''} onChange={e=>setEditingClient({...editingClient, dueTime:e.target.value})} /></div>
          </div>

          <div className="flex space-x-2 mt-4">
             <button onClick={()=>handleSave(false)} className="flex-1 bg-brand-blue text-white p-2 rounded"><Save size={18} className="inline mr-2"/> {t('save')}</button>
             {!isEditing && <button onClick={()=>handleSave(true)} className="flex-1 bg-green-600 text-white p-2 rounded"><Plus size={18} className="inline mr-2"/> {t('saveAndNew')}</button>}
             <button onClick={()=>setShowForm(false)} className="flex-1 bg-gray-300 text-gray-800 p-2 rounded">{t('cancel')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 md:pb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{t('manageClients')}</h2>
        <button onClick={handleAddNew} className="bg-brand-blue text-white p-2 rounded-full shadow-lg"><Plus size={24} /></button>
      </div>
      <SearchFilterBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterValue={filterPlan} setFilterValue={setFilterPlan} filterOptions={[{value:'all', label:t('allPlans')}, ...data.plans.map(p=>({value:p.id, label:p.name}))]} placeholder={t('searchClient')} />
      <div className="space-y-3">
         {filtered.map(client => (
            <div key={client.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
               <div className="flex items-center">
                  <img src={client.profileImage || SPLASH_IMAGE} className="w-10 h-10 rounded-full mr-3 object-cover" />
                  <div>
                     <p className="font-bold">{client.name}</p>
                     <p className="text-xs text-gray-500">{data.plans.find(p=>p.id===client.planId)?.name}</p>
                  </div>
               </div>
               <div className="flex space-x-2">
                  <button onClick={() => setMessageModal({isOpen: true, client})} className="p-2 text-green-600 bg-green-50 rounded"><MessageSquare size={18}/></button>
                  <button onClick={() => handleEdit(client)} className="p-2 text-blue-600 bg-blue-50 rounded"><Edit2 size={18}/></button>
                  <button onClick={() => deleteClient(client.id)} className="p-2 text-red-600 bg-red-50 rounded"><Trash2 size={18}/></button>
               </div>
            </div>
         ))}
      </div>
      
      {/* Message Modal */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4">{t('sendMessage')}</h3>
              <p className="text-gray-600 mb-4">{t('client')}: {messageModal.client?.name}</p>
              <button onClick={() => { window.open(`https://wa.me/${messageModal.client?.whatsapp}`, '_blank'); setMessageModal({isOpen:false, client:null}); }} className="w-full bg-green-600 text-white p-3 rounded font-bold mb-2 flex justify-center items-center"><MessageCircle className="mr-2"/> {t('writePersonalized')}</button>
              <button onClick={() => { 
                const templates = data.messageTemplates;
                if(templates.length === 0) alert("Nenhum modelo cadastrado.");
                else {
                   const t = templates[0];
                   let text = t.content.replace('{nome}', messageModal.client!.name).replace('{data}', parseLocalDate(messageModal.client!.dueDate).toLocaleDateString());
                   window.open(`https://wa.me/${messageModal.client?.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
                   setMessageModal({isOpen:false, client:null});
                }
              }} className="w-full bg-blue-600 text-white p-3 rounded font-bold mb-2 flex justify-center items-center"><FileText className="mr-2"/> {t('useTemplate')}</button>
              <button onClick={() => setMessageModal({isOpen:false, client:null})} className="w-full bg-gray-200 text-gray-800 p-3 rounded">{t('cancel')}</button>
           </div>
        </div>
      )}
    </div>
  );
};

const PlanList = () => {
  const { data, addPlan, updatePlan, deletePlan, isLicenseValid, t } = useContext(AppContext);
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);

  const handleSave = () => {
    if(!editing?.name || !editing?.price) return;
    if(editing.id) updatePlan(editing as Plan);
    else addPlan({...editing, id: Date.now().toString()} as Plan);
    setEditing(null);
  };

  return (
    <div className="p-4 pb-20 md:pb-4">
      <div className="flex justify-between items-center mb-4">
         <h2 className="text-xl font-bold">{t('managePlans')}</h2>
         <button onClick={() => { if(!isLicenseValid && data.plans.length >= 5) return; setEditing({}); }} className="bg-brand-blue text-white p-2 rounded-full shadow"><Plus size={24}/></button>
      </div>
      {editing && (
        <div className="bg-white p-4 rounded shadow mb-4">
           <input className="w-full p-2 border rounded mb-2" placeholder={t('planNamePlaceholder')} value={editing.name||''} onChange={e=>setEditing({...editing, name:e.target.value})}/>
           <input type="number" className="w-full p-2 border rounded mb-2" placeholder={t('planPricePlaceholder')} value={editing.price||''} onChange={e=>setEditing({...editing, price:Number(e.target.value)})}/>
           <div className="flex space-x-2"><button onClick={handleSave} className="flex-1 bg-brand-blue text-white p-2 rounded">{t('save')}</button><button onClick={()=>setEditing(null)} className="flex-1 bg-gray-300 p-2 rounded">{t('cancel')}</button></div>
        </div>
      )}
      <div className="space-y-3">
         {data.plans.map(p => (
            <div key={p.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
               <div><p className="font-bold">{p.name}</p><p className="text-gray-500">R$ {p.price.toFixed(2)}</p></div>
               <div className="flex space-x-2"><button onClick={()=>setEditing(p)} className="p-2 bg-blue-50 text-blue-600 rounded"><Edit2 size={18}/></button><button onClick={()=>deletePlan(p.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 size={18}/></button></div>
            </div>
         ))}
      </div>
    </div>
  );
};

const ClientExpirationsList = () => {
  const { data, updateClient, t } = useContext(AppContext);
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [chargeModal, setChargeModal] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const today = new Date(); today.setHours(0,0,0,0);
  
  const filtered = data.clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'paid' ? c.paymentStatus === 'paid' : c.paymentStatus === 'pending');
    return matchesSearch && matchesStatus;
  }).sort((a,b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());

  const handleRenew = (client: Client, days: number) => {
    const currentDue = parseLocalDate(client.dueDate);
    currentDue.setDate(currentDue.getDate() + days);
    const plan = data.plans.find(p => p.id === client.planId);
    const addedValue = (plan?.price || 0) * (days/30);
    const currentDebt = client.paymentStatus === 'pending' ? (client.amountOwed || 0) : 0;
    const newTotal = currentDebt + addedValue;

    const newHistory = [...(client.paymentHistory || [])];

    if (confirm(t('confirmRenew', { name: client.name, days: days, date: currentDue.toLocaleDateString(), value: newTotal.toFixed(2) }))) {
       newHistory.push({ date: new Date().toISOString(), amount: newTotal });
       updateClient({ ...client, dueDate: currentDue.toISOString().split('T')[0], paymentStatus: 'paid', amountOwed: 0, paymentHistory: newHistory });
    } else {
       updateClient({ ...client, dueDate: currentDue.toISOString().split('T')[0], paymentStatus: 'pending', amountOwed: newTotal, paymentHistory: newHistory });
    }
  };

  return (
    <div className="p-4 pb-20 md:pb-4 space-y-4">
      <SearchFilterBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterValue={filterStatus} setFilterValue={setFilterStatus} filterOptions={[{value:'all', label:t('all')}, {value:'pending', label:t('noPending')}, {value:'paid', label:t('yesPaid')}]} placeholder={t('search')} />
      {filtered.map(client => {
         const diff = Math.ceil((parseLocalDate(client.dueDate).getTime() - today.getTime()) / 86400000);
         const statusColor = diff < 0 ? 'text-red-600' : diff === 0 ? 'text-orange-500' : 'text-green-600';
         const statusText = diff < 0 ? t('overdue') : diff === 0 ? t('dueTodayStatus') : t('dueSoon');
         return (
           <div key={client.id} className="bg-white p-4 rounded shadow">
             <div className="flex justify-between items-start mb-2">
                <div>
                   <p className="font-bold">{client.name}</p>
                   <p className={`text-sm font-bold ${statusColor}`}>{statusText} ({parseLocalDate(client.dueDate).toLocaleDateString()})</p>
                   {client.paymentStatus === 'pending' && (
                     <div className="mt-1">
                       {(() => {
                          const payDate = parseLocalDate(client.paymentDate || client.dueDate);
                          const diffDaysPay = Math.ceil((payDate.getTime() - today.getTime()) / 86400000);
                          let label = '';
                          let colorClass = '';

                          if (diffDaysPay < 0) {
                             label = `${t('paymentOverdue', { defaultValue: 'Pagamento Vencido' })} (${payDate.toLocaleDateString()})`;
                             colorClass = 'text-red-800 font-black animate-pulse';
                          } else if (diffDaysPay === 0) {
                             label = t('paymentDueToday', { defaultValue: 'Pagamento Vence Hoje' });
                             colorClass = 'text-orange-600 font-bold';
                          } else {
                             label = `${t('paymentDue', { defaultValue: 'Pagamento Vence' })} ${payDate.toLocaleDateString()}`;
                             colorClass = 'text-blue-600 font-semibold';
                          }

                          return (
                            <>
                              <p className={`text-xs ${colorClass}`}>{label}</p>
                              <p className="text-xs text-red-600 font-bold">{t('pendingValue')}: R$ {(client.amountOwed || 0).toFixed(2)}</p>
                            </>
                          );
                       })()}
                     </div>
                   )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                   <button onClick={() => setPaymentModal(client)} className={`px-2 py-1 rounded text-xs font-bold ${client.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{client.paymentStatus === 'paid' ? t('paid').toUpperCase() : t('noPending').toUpperCase()}</button>
                   {client.paymentStatus !== 'paid' && <button onClick={() => setChargeModal(client)} className="px-2 py-1 bg-brand-blue text-white rounded text-xs">{t('charge')}</button>}
                </div>
             </div>
             <div className="flex space-x-2 mt-3">
                {[30, 60, 90].map(d => <button key={d} onClick={() => handleRenew(client, d)} className="flex-1 bg-gray-100 hover:bg-gray-200 p-2 rounded text-xs font-bold">+{d} {t('days')}</button>)}
             </div>
           </div>
         );
      })}
      <PaymentModal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)} totalValue={paymentModal?.amountOwed || 0} title={`${t('payAccount')} - ${paymentModal?.name}`} onConfirm={(type: any, amount: any) => {
         const paidAmount = type === 'total' ? paymentModal!.amountOwed || 0 : amount;
         const newHistory = [...(paymentModal!.paymentHistory || []), { date: new Date().toISOString(), amount: paidAmount }];

         if (type === 'total') updateClient({...paymentModal, paymentStatus: 'paid', amountOwed: 0, paymentHistory: newHistory});
         else updateClient({...paymentModal, amountOwed: (paymentModal.amountOwed || 0) - amount, paymentHistory: newHistory});
         setPaymentModal(null);
      }} />
      <ChargeModal isOpen={!!chargeModal} onClose={() => setChargeModal(null)} client={chargeModal} plan={data.plans.find(p => p.id === chargeModal?.planId)} settings={data.settings} />
    </div>
  );
};

const AccountsPayableList = () => {
  const { data, addAccount, updateAccount, deleteAccount, isLicenseValid, t } = useContext(AppContext);
  const [editing, setEditing] = useState<(Partial<AccountPayable> & { startDate?: string }) | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [expandedAccId, setExpandedAccId] = useState<string | null>(null);

  const handleSave = () => {
    if (!editing?.name || !editing?.totalValue) return;
    const installments = [];
    // Start generating dates from the selected startDate or today
    const start = editing.startDate ? parseLocalDate(editing.startDate) : new Date();
    
    for(let i=0; i<(editing.installmentsCount||1); i++) {
       const d = new Date(start); 
       // Increment month for each installment. Note: setMonth handles year rollover.
       // The first installment is the Start Date.
       d.setMonth(d.getMonth() + i);
       
       installments.push({ 
         id: Date.now()+i+'', 
         number: i+1, 
         value: (editing.totalValue || 0)/(editing.installmentsCount||1), 
         dueDate: d.toISOString().split('T')[0], 
         status: 'pending' 
       });
    }
    const acc = { ...editing, id: editing.id || Date.now().toString(), installments: editing.installments || installments } as AccountPayable;
    if (editing.id) updateAccount(acc); else addAccount(acc);
    setShowForm(false); setEditing(null);
  };

  return (
    <div className="p-4 pb-20 md:pb-4">
      <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{t('accountsPayable')}</h2><button onClick={()=>{if(!isLicenseValid && data.accountsPayable.length >= 5) return; setEditing({}); setShowForm(true);}} className="bg-brand-blue text-white p-2 rounded-full shadow"><Plus/></button></div>
      {showForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
           {/* Name */}
           <input className="w-full p-2 border rounded mb-2" placeholder={t('accountName')} value={editing?.name||''} onChange={e=>setEditing({...editing!, name:e.target.value})}/>
           
           {/* Total Value */}
           <input type="number" className="w-full p-2 border rounded mb-2" placeholder={t('totalValue')} value={editing?.totalValue||''} onChange={e=>setEditing({...editing!, totalValue:Number(e.target.value)})}/>
           
           {/* Installments and Date Row */}
           <div className="flex space-x-2 mb-2">
             <div className="flex-1">
               <input type="number" className="w-full p-2 border rounded" placeholder={t('installments')} value={editing?.installmentsCount||1} onChange={e=>setEditing({...editing!, installmentsCount:Number(e.target.value)})}/>
             </div>
             <div className="flex-1">
               <input type="date" className="w-full p-2 border rounded bg-gray-100" value={editing?.startDate||''} onChange={e=>setEditing({...editing!, startDate:e.target.value})}/>
             </div>
           </div>

           {/* Description */}
           <input className="w-full p-2 border border-yellow-500 rounded mb-4" placeholder={t('description')} value={editing?.description||''} onChange={e=>setEditing({...editing!, description:e.target.value})}/>

           <div className="flex space-x-2">
            <button onClick={handleSave} className="flex-1 bg-brand-blue text-white p-2 rounded">{t('save')}</button>
            <button onClick={()=>{setShowForm(false); setEditing(null);}} className="flex-1 bg-gray-300 text-gray-800 p-2 rounded">{t('cancel')}</button>
           </div>
        </div>
      )}
      <div className="space-y-4">
        {data.accountsPayable.map(acc => (
          <div key={acc.id} className="bg-white p-4 rounded shadow cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedAccId(expandedAccId === acc.id ? null : acc.id)}>
             <div className="flex justify-between mb-2">
               <h3 className="font-bold">{acc.name}</h3>
               <span className="font-bold text-gray-600">{t('total')}: R$ {acc.totalValue.toFixed(2)}</span>
             </div>
             {/* Only show details if expanded */}
             {expandedAccId === acc.id && (
               <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 animate-fade-in">
                  {acc.description && <p className="text-sm text-gray-500 italic mb-2">{acc.description}</p>}
                  <div className="space-y-1">
                    {acc.installments.map(inst => (
                      <div key={inst.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded items-center">
                          <span className={`${inst.status==='paid'?'text-green-600 font-bold line-through opacity-75':''}`}>{inst.number}x - {parseLocalDate(inst.dueDate).toLocaleDateString()}</span>
                          <div className="flex items-center space-x-2">
                            <span className={`${inst.status==='paid'?'text-green-600 font-bold':''}`}>R$ {inst.value.toFixed(2)}</span>
                            {inst.status === 'paid' ? 
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded flex items-center"><Check size={12} className="mr-1"/>{t('paid')}</span> 
                              : 
                              <button onClick={(e)=>{e.stopPropagation(); setPayModal({acc, inst})}} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200">{t('toPay')}</button>
                            }
                          </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }} className="text-red-500 text-xs flex items-center hover:underline"><Trash2 size={12} className="mr-1"/> Excluir Conta</button>
                  </div>
               </div>
             )}
             {/* Hint for interaction if collapsed */}
             {expandedAccId !== acc.id && <p className="text-center text-xs text-gray-400 mt-2">Toque para ver detalhes</p>}
          </div>
        ))}
      </div>
      <PaymentModal isOpen={!!payModal} onClose={()=>setPayModal(null)} title={t('payAccount')} totalValue={payModal?.inst?.value || 0} onConfirm={(type:any, amount:any) => {
         const updatedInsts = payModal.acc.installments.map((i:any) => i.id === payModal.inst.id ? { ...i, status: type==='total'?'paid':'pending', value: type==='total'?0 : i.value-amount } : i);
         updateAccount({ ...payModal.acc, installments: updatedInsts });
         setPayModal(null);
      }} />
    </div>
  );
};

const SettingsView = () => {
  const { data, saveSettings, isLicenseValid, t } = useContext(AppContext);
  const [settings, setSettings] = useState(data.settings);
  const [openGerais, setOpenGerais] = useState(true);
  const [openProfile, setOpenProfile] = useState(false);
  const [openDash, setOpenDash] = useState(false);
  const [openLanguage, setOpenLanguage] = useState(false);

  const handleSave = () => { saveSettings(settings); alert(t('configSaved')); };
  const toggle = (setter: any) => setter((prev: boolean) => !prev);

  return (
    <div className="p-4 pb-20 md:pb-4 space-y-4">
      <h2 className="text-xl font-bold mb-4">{t('settings')}</h2>
      
      {/* Gerais Accordion */}
      <div className="bg-white rounded shadow overflow-hidden">
        <button onClick={() => toggle(setOpenGerais)} className="w-full flex justify-between items-center p-4 bg-gray-50 font-bold">
          <div className="flex items-center"><SettingsIcon size={20} className="mr-2"/> {t('general')}</div>
          {openGerais ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
        </button>
        {openGerais && (
          <div className="p-4 space-y-4 border-t">
             {/* Sub: Perfil e Pix */}
             <div className="border rounded">
               <button onClick={() => toggle(setOpenProfile)} className="w-full flex justify-between items-center p-3 bg-gray-100 font-semibold text-sm">
                  <span>{t('companyProfilePix')}</span>
                  {openProfile ? <ChevronUp size={16}/> : <ChevronRight size={16}/>}
               </button>
               {openProfile && (
                 <div className="p-3 space-y-3 bg-white">
                    {!isLicenseValid && <p className="text-xs text-orange-600 font-bold">{t('requireLicense')}</p>}
                    <input className="w-full p-2 border rounded" placeholder={t('companyName')} value={settings.companyName} onChange={e=>setSettings({...settings, companyName:e.target.value})} disabled={!isLicenseValid}/>
                    <input className="w-full p-2 border rounded" placeholder={t('document')} value={settings.document} onChange={e=>setSettings({...settings, document:e.target.value})} disabled={!isLicenseValid}/>
                    <h4 className="font-bold text-sm mt-2">{t('pixConfig')}</h4>
                    <input className="w-full p-2 border rounded" placeholder={t('pixName')} value={settings.pixName} onChange={e=>setSettings({...settings, pixName:e.target.value})} disabled={!isLicenseValid}/>
                    <input className="w-full p-2 border rounded" placeholder={t('pixKey')} value={settings.pixKey} onChange={e=>setSettings({...settings, pixKey:e.target.value})} disabled={!isLicenseValid}/>
                 </div>
               )}
             </div>

             {/* Sub: Dashboard */}
             <div className="border rounded">
               <button onClick={() => toggle(setOpenDash)} className="w-full flex justify-between items-center p-3 bg-gray-100 font-semibold text-sm">
                  <span>{t('dashboardPreferences')}</span>
                  {openDash ? <ChevronUp size={16}/> : <ChevronRight size={16}/>}
               </button>
               {openDash && (
                 <div className="p-3 space-y-3 bg-white">
                    <div className="flex items-center justify-between"><span className="text-sm font-bold">{t('clientAlerts')}</span><input type="checkbox" checked={settings.dashboardShowClientAlerts} onChange={e=>setSettings({...settings, dashboardShowClientAlerts:e.target.checked})} disabled={!isLicenseValid}/></div>
                    <div className="flex items-center justify-between"><span className="text-sm">Dias para Vencer</span><input type="number" className="w-16 p-1 border rounded" value={settings.dashboardUrgentDays || 1} onChange={e=>setSettings({...settings, dashboardUrgentDays:Number(e.target.value)})} disabled={!isLicenseValid}/></div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t"><span className="text-sm">{t('showDebtors')}</span><input type="checkbox" checked={settings.dashboardShowPaymentMonitoring} onChange={e=>setSettings({...settings, dashboardShowPaymentMonitoring:e.target.checked})} disabled={!isLicenseValid}/></div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t"><span className="text-sm font-bold">{t('showAccountsDash')}</span><input type="checkbox" checked={settings.dashboardShowAccounts} onChange={e=>setSettings({...settings, dashboardShowAccounts:e.target.checked})} disabled={!isLicenseValid}/></div>
                    <div className="flex items-center justify-between"><span className="text-sm">{t('daysToPayAccount')}</span><input type="number" className="w-16 p-1 border rounded" value={settings.dashboardAccountsDays || 1} onChange={e=>setSettings({...settings, dashboardAccountsDays:Number(e.target.value)})} disabled={!isLicenseValid}/></div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t"><span className="text-sm">{t('daysAdvanceReceivables')}</span><input type="number" className="w-16 p-1 border rounded" value={settings.dashboardAlertDays} onChange={e=>setSettings({...settings, dashboardAlertDays:Number(e.target.value)})} disabled={!isLicenseValid}/></div>
                 </div>
               )}
             </div>

             {/* Sub: Idioma */}
             <div className="border rounded">
               <button onClick={() => toggle(setOpenLanguage)} className="w-full flex justify-between items-center p-3 bg-gray-100 font-semibold text-sm">
                  <span>{t('language')}</span>
                  {openLanguage ? <ChevronUp size={16}/> : <ChevronRight size={16}/>}
               </button>
               {openLanguage && (
                 <div className="p-3 space-y-3 bg-white">
                    <select className="w-full p-2 border rounded" value={settings.language || 'pt'} onChange={e=>setSettings({...settings, language:e.target.value as any})}>
                        <option value="pt">{t('portuguese')}</option>
                        <option value="en">{t('english')}</option>
                        <option value="es">{t('spanish')}</option>
                    </select>
                 </div>
               )}
             </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow">
         <h3 className="font-bold mb-4 flex items-center"><Briefcase size={20} className="mr-2"/> {t('supportCentral')}</h3>
         <div className="flex items-center space-x-4">
            <img src={SUPPORT_IMAGE} className="w-16 h-16 rounded-full object-cover"/>
            <div><p className="font-bold">WhatsApp: {SUPPORT_PHONE}</p><p className="text-sm text-gray-500">{SUPPORT_EMAIL}</p></div>
         </div>
      </div>

      <button onClick={handleSave} className="w-full bg-brand-blue text-white p-3 rounded font-bold">{t('saveChanges')}</button>
    </div>
  );
};

const CommunicationView = () => {
  const { data, addMessageTemplate, t } = useContext(AppContext);
  const [newTemplate, setNewTemplate] = useState<Partial<MessageTemplate>>({ type: 'general' });

  return (
    <div className="p-4 pb-20 md:pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
       <div className="md:col-span-1 bg-white p-4 rounded shadow min-w-0">
          <h3 className="font-bold mb-2">{t('newMessageModel')}</h3>
          <input className="w-full p-2 border rounded mb-2" placeholder={t('title')} value={newTemplate.title||''} onChange={e=>setNewTemplate({...newTemplate, title:e.target.value})}/>
          <select className="w-full p-2 border rounded mb-2" value={newTemplate.type} onChange={e=>setNewTemplate({...newTemplate, type:e.target.value as any})}>
             <option value="general">{t('generalType')}</option><option value="renewal">{t('renewalType')}</option><option value="overdue">{t('overdueType')}</option><option value="black_friday">{t('blackFridayType')}</option><option value="offer">{t('offerType')}</option><option value="birthday">{t('birthdayType')}</option>
          </select>
          <textarea className="w-full p-2 border rounded mb-2 h-32" placeholder={t('content')} value={newTemplate.content||''} onChange={e=>setNewTemplate({...newTemplate, content:e.target.value})}/>
          <button onClick={()=>{if(newTemplate.title && newTemplate.content) { addMessageTemplate({...newTemplate, id:Date.now().toString()} as MessageTemplate); setNewTemplate({type:'general', title:'', content:''}); }}} className="w-full bg-brand-blue text-white p-2 rounded">{t('add')}</button>
       </div>
       <div className="md:col-span-2 space-y-2">
          {data.messageTemplates.map(t => (
             <div key={t.id} className="bg-white p-3 rounded shadow">
                <p className="font-bold text-sm">{t.title} <span className="text-gray-400 text-xs">({t.type})</span></p>
                <p className="text-gray-600 text-xs mt-1 truncate">{t.content}</p>
             </div>
          ))}
       </div>
    </div>
  );
};

const LicensePlansPage = () => {
  const { t } = useContext(AppContext);
  return (
  <div className="p-4 pb-20 md:pb-4 space-y-4">
    <h2 className="text-xl font-bold text-center mb-6">{t('licensePlansTitle')}</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
       {[
         { name: t('monthly'), price: 3.90, features: [t('access30Days'), t('supportPriority'), t('updatesIncluded')], color: 'bg-blue-600' },
         { name: t('annual'), price: 19.90, features: [t('access365Days'), t('supportVIP'), t('realEconomy')], color: 'bg-purple-600' },
         { name: t('lifetime'), price: 49.90, features: [t('accessPermanent'), t('supportLifetime'), t('singlePayment')], color: 'bg-black' }
       ].map(plan => (
         <div key={plan.name} className={`${plan.color} text-white rounded-xl p-6 shadow-xl flex flex-col items-center transform hover:scale-105 transition-transform`}>
            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
            <p className="text-4xl font-extrabold mb-4">R$ {plan.price.toFixed(2)}</p>
            <ul className="space-y-2 mb-6 text-sm">{plan.features.map(f=><li key={f} className="flex items-center"><Check size={16} className="mr-2"/> {f}</li>)}</ul>
            <button onClick={()=>window.open(`https://wa.me/${SUPPORT_PHONE}?text=Quero o plano ${plan.name}`, '_blank')} className="bg-white text-gray-900 font-bold py-3 px-8 rounded-full shadow hover:bg-gray-100">{t('buyNow')}</button>
         </div>
       ))}
    </div>
  </div>
);
};

const LicenseActivationPage = () => {
  const { activateLicense, data, t } = useContext(AppContext);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');

  return (
    <div className="p-4 pb-20 md:pb-4 flex flex-col items-center">
       <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md text-center">
          <Key size={48} className="mx-auto text-brand-blue mb-4"/>
          <h2 className="text-xl font-bold mb-2">{t('activateLicense')}</h2>
          <p className="text-gray-600 mb-4 text-sm">{t('enterKey')}</p>
          <input className="w-full p-3 border rounded mb-4 text-center uppercase tracking-widest font-mono" placeholder="XXXX-XXXX-XXXX-XXXX" value={key} onChange={e=>setKey(e.target.value)}/>
          <button onClick={() => { const res = activateLicense(key); setMsg(res === 'success' ? t('keySuccess') : res === 'duplicate' ? t('keyDuplicate') : t('keyInvalid')); }} className="w-full bg-green-600 text-white p-3 rounded font-bold mb-4">{t('activate')}</button>
          {msg && <p className={`font-bold ${msg.includes(t('keySuccess'))?'text-green-600':'text-red-600'}`}>{msg}</p>}
          <div className="mt-4 pt-4 border-t text-left">
             <p className="text-xs text-gray-500 font-bold">{t('currentStatus')}</p>
             <p className={`font-bold ${data.license.isActive?'text-green-600':'text-red-600'}`}>{data.license.isActive ? `${t('activeUntil')} ${new Date(data.license.expirationDate).toLocaleDateString()}` : t('inactive')}</p>
          </div>
       </div>
    </div>
  );
};

const FinancialControl = () => {
  const { t } = useContext(AppContext);
  const [tab, setTab] = useState<'expirations' | 'accounts'>('expirations');
  return (
    <div className="flex flex-col h-full">
       <div className="bg-brand-blue text-white p-4 text-center">
          <p className="text-sm font-medium">{t('financialControlTitle')}</p>
       </div>
       <div className="flex bg-white shadow">
          <button onClick={()=>setTab('expirations')} className={`flex-1 p-3 text-sm font-bold border-b-2 ${tab==='expirations'?'border-brand-blue text-brand-blue':'border-transparent text-gray-500'}`}>{t('expirations')}</button>
          <button onClick={()=>setTab('accounts')} className={`flex-1 p-3 text-sm font-bold border-b-2 ${tab==='accounts'?'border-brand-blue text-brand-blue':'border-transparent text-gray-500'}`}>{t('accountsPayable')}</button>
       </div>
       <div className="flex-1 overflow-auto">
          {tab === 'expirations' ? <ClientExpirationsList/> : <AccountsPayableList/>}
       </div>
    </div>
  );
};

// --- Layout ---

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { navigate, currentView, t } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: BarChart2 },
    { id: 'clients', label: t('manageClients'), icon: Users },
    { id: 'plans', label: t('managePlans'), icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Mobile Header */}
      <div className="md:hidden fixed w-full bg-brand-blue text-white z-40 flex justify-between items-center p-4 shadow-md">
        <span className="font-bold text-lg tracking-wider">Pocket Plan Manager</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={28} /></button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed md:relative z-50 w-64 h-full bg-brand-blue text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col shadow-2xl`}>
        <div className="p-6 flex justify-between items-center border-b border-blue-900">
          <h2 className="text-2xl font-bold tracking-tighter">Pocket Plan Manager</h2>
          <button className="md:hidden text-white" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => { navigate(item.id as ViewState); setIsSidebarOpen(false); }} className={`w-full flex items-center px-6 py-3 hover:bg-blue-800 transition-colors ${currentView === item.id ? 'bg-blue-900 border-r-4 border-white' : ''}`}>
              <item.icon size={20} className="mr-3" /> <span className="font-medium">{item.label}</span>
            </button>
          ))}

          {/* Collapsible Control Menu */}
          <div>
            <button onClick={() => setControlOpen(!controlOpen)} className="w-full flex items-center justify-between px-6 py-3 hover:bg-blue-800 transition-colors">
              <div className="flex items-center"><DollarSign size={20} className="mr-3"/> <span className="font-medium">{t('control')}</span></div>
              {controlOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {controlOpen && (
              <div className="bg-blue-900">
                <button onClick={() => { navigate('expirations'); setIsSidebarOpen(false); }} className={`w-full flex items-center pl-12 pr-6 py-2 text-sm hover:bg-blue-800 ${currentView === 'expirations' ? 'text-white font-bold' : 'text-gray-300'}`}>{t('expirations')}</button>
                <button onClick={() => { navigate('accounts'); setIsSidebarOpen(false); }} className={`w-full flex items-center pl-12 pr-6 py-2 text-sm hover:bg-blue-800 ${currentView === 'accounts' ? 'text-white font-bold' : 'text-gray-300'}`}>{t('accountsPayable')}</button>
              </div>
            )}
          </div>

          <button onClick={() => { navigate('communication'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-6 py-3 hover:bg-blue-800 transition-colors ${currentView === 'communication' ? 'bg-blue-900 border-r-4 border-white' : ''}`}>
             <MessageCircle size={20} className="mr-3" /> <span className="font-medium">{t('messages')}</span>
          </button>

          <div className="pt-4 mt-4 border-t border-blue-900">
             <button onClick={() => { navigate('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-6 py-3 hover:bg-blue-800 transition-colors ${currentView === 'settings' ? 'bg-blue-900 border-r-4 border-white' : ''}`}>
               <SettingsIcon size={20} className="mr-3" /> <span className="font-medium">{t('settings')}</span>
             </button>
             <button onClick={() => { navigate('licensePlans'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-6 py-3 hover:bg-blue-800 text-yellow-400 font-bold`}>
               <Crown size={20} className="mr-3"/> {t('licensePlansTitle')}
             </button>
             <button onClick={() => { navigate('activation'); setIsSidebarOpen(false); }} className={`w-full flex items-center px-6 py-3 hover:bg-blue-800 transition-colors`}>
               <Key size={20} className="mr-3" /> <span className="font-medium">{t('activateLicense')}</span>
             </button>
          </div>
        </nav>
        
        <div className="p-4 border-t border-blue-900 text-center text-xs text-gray-400">
          <p className="mb-1 font-semibold text-gray-300">By: Maicon Coutinho</p>
          <p>© 2025 S.F.D Soluções</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-16">
        {children}
      </main>
    </div>
  );
};

const MainContent = () => {
  const { currentView } = useContext(AppContext);
  switch (currentView) {
    case 'dashboard': return <Dashboard />;
    case 'clients': return <ClientList />;
    case 'plans': return <PlanList />;
    case 'expirations': return <FinancialControl />; // Wrapper for tabs
    case 'accounts': return <FinancialControl />; // Wrapper for tabs
    case 'communication': return <CommunicationView />;
    case 'settings': return <SettingsView />;
    case 'licensePlans': return <LicensePlansPage />;
    case 'activation': return <LicenseActivationPage />;
    default: return <Dashboard />;
  }
};

export const App = () => {
  const [loading, setLoading] = useState(true);

  if (loading) {
     return <AppProvider><SplashScreen onFinish={() => setLoading(false)} /></AppProvider>;
  }

  return (
    <AppProvider>
      <Layout>
        <MainContent />
      </Layout>
    </AppProvider>
  );
};
