import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Users, Calendar, CreditCard, Settings as SettingsIcon, 
  MessageCircle, BarChart2, Plus, Trash2, Edit2, 
  Check, AlertTriangle, Key, Save, Upload, Download,
  Menu, X, DollarSign, RefreshCw, Image as ImageIcon, Camera, Lock, Clock, AlertOctagon, MessageSquare, Briefcase, ChevronDown, ChevronUp, Calendar as CalendarIcon, FileText, Phone, UserPlus, Crown, Star, ShieldCheck, Award, Cake, QrCode, Share2, Search, Filter, Monitor
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { AppData, Client, Plan, Settings, MessageTemplate, ViewState, AccountPayable, AccountInstallment } from './types';
import { SPLASH_IMAGE, SUPPORT_IMAGE, SUPPORT_PHONE, SUPPORT_EMAIL, DAILY_KEYS, ANNUAL_KEYS, LIFETIME_KEYS, DEFAULT_TEMPLATES } from './constants';

// --- Helpers ---

// Fix for Date Parsing to avoid timezone issues (e.g. 02/01 becoming 01/01)
const parseLocalDate = (dateStr: string | undefined) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// CRC16 Calculation for Pix
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

// Generate Pix Copy & Paste Code
const generatePix = (key: string, name: string, city: string, amount: number, txId: string = '***') => {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const payload = [
    formatField('00', '01'), // Payload Format Indicator
    formatField('26', `0014br.gov.bcb.pix01${key.length.toString().padStart(2, '0')}${key}`), // Merchant Account Info
    formatField('52', '0000'), // Merchant Category Code
    formatField('53', '986'), // Transaction Currency (BRL)
    formatField('54', amount.toFixed(2)), // Transaction Amount
    formatField('58', 'BR'), // Country Code
    formatField('59', name.substring(0, 25).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")), // Merchant Name
    formatField('60', city.substring(0, 15).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")), // Merchant City
    formatField('62', formatField('05', txId)) // Additional Data Field
  ].join('');

  const crcPayload = `${payload}6304`;
  const crc = crc16ccitt(crcPayload);
  return `${crcPayload}${crc}`;
};

// --- Context & State Management ---

const INITIAL_DATA: AppData = {
  clients: [],
  plans: [],
  accountsPayable: [],
  settings: {
    companyName: 'IPTV SUL BR',
    ownerName: '',
    document: '',
    otherInfo: '',
    profileImage: SPLASH_IMAGE,
    supportImage: SUPPORT_IMAGE,
    dashboardAlertDays: 30, 
    dashboardShowClientAlerts: true,
    dashboardShowBirthdays: true,
    dashboardBirthdayDays: 0,
    dashboardShowAccounts: true,
    dashboardAccountsDays: 7,
    dashboardShowPaymentMonitoring: true,
    pixName: '',
    pixKeyType: 'email',
    pixKey: ''
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
  checkLicense: () => void;
  addMessageTemplate: (template: MessageTemplate) => void;
  navigate: (view: ViewState) => void;
  currentView: ViewState;
  isLicenseValid: boolean;
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
  checkLicense: () => {},
  addMessageTemplate: () => {},
  navigate: () => {},
  currentView: 'dashboard',
  isLicenseValid: false
});

const AppProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('iptv_manager_data');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
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

  const addClient = (client: Client) => {
    setData(prev => ({ ...prev, clients: [...prev.clients, client] }));
  };

  const updateClient = (updatedClient: Client) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === updatedClient.id ? updatedClient : c)
    }));
  };

  const deleteClient = (id: string) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== id)
    }));
  };

  const addPlan = (plan: Plan) => {
    setData(prev => ({ ...prev, plans: [...prev.plans, plan] }));
  };

  const updatePlan = (updatedPlan: Plan) => {
    setData(prev => ({
      ...prev,
      plans: prev.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
    }));
  };

  const deletePlan = (id: string) => {
    setData(prev => ({
      ...prev,
      plans: prev.plans.filter(p => p.id !== id)
    }));
  };

  const addAccount = (account: AccountPayable) => {
    setData(prev => ({ ...prev, accountsPayable: [...prev.accountsPayable, account] }));
  };

  const updateAccount = (updatedAccount: AccountPayable) => {
    setData(prev => ({
      ...prev,
      accountsPayable: prev.accountsPayable.map(a => a.id === updatedAccount.id ? updatedAccount : a)
    }));
  };

  const deleteAccount = (id: string) => {
    setData(prev => ({
      ...prev,
      accountsPayable: prev.accountsPayable.filter(a => a.id !== id)
    }));
  };

  const saveSettings = (newSettings: Settings) => {
    setData(prev => ({ ...prev, settings: newSettings }));
  };

  const addMessageTemplate = (template: MessageTemplate) => {
    setData(prev => ({ ...prev, messageTemplates: [...prev.messageTemplates, template] }));
  }

  const checkLicense = () => {
    // Logic checked in useMemo
  };

  const activateLicense = (inputKey: string) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateKey = `${day}/${month}`;
    
    // 1. Check Daily Key (30 Days)
    const validDailyKey = DAILY_KEYS[dateKey];
    if (inputKey === validDailyKey) {
      // Logic: Cannot use same Daily Key twice in the same year
      const alreadyUsed = data.license.usedKeys?.some(k => k.key === inputKey && k.year === currentYear);
      if (alreadyUsed) return 'duplicate';

      const currentExp = new Date(data.license.expirationDate);
      const now = new Date();
      const baseDate = data.license.isActive && currentExp > now ? currentExp : now;
      const newExp = new Date(baseDate);
      newExp.setDate(newExp.getDate() + 30); // Add 30 days

      const newUsedKeys = [...(data.license.usedKeys || []), { key: inputKey, year: currentYear }];
      setData(prev => ({
        ...prev,
        license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: newUsedKeys }
      }));
      return 'success';
    }

    // 2. Check Annual Key (365 Days)
    const isAnnualKey = Object.values(ANNUAL_KEYS).includes(inputKey);
    if (isAnnualKey) {
       // Logic: Cannot reuse specific annual key ever
       const alreadyUsed = data.license.usedKeys?.some(k => k.key === inputKey);
       if (alreadyUsed) return 'duplicate';

       const currentExp = new Date(data.license.expirationDate);
       const now = new Date();
       const baseDate = data.license.isActive && currentExp > now ? currentExp : now;
       const newExp = new Date(baseDate);
       newExp.setDate(newExp.getDate() + 365); // Add 365 days

       const newUsedKeys = [...(data.license.usedKeys || []), { key: inputKey, year: currentYear }];
       setData(prev => ({
         ...prev,
         license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: newUsedKeys }
       }));
       return 'success';
    }

    // 3. Check Lifetime Key (Permanent/100 Years)
    const isLifetimeKey = Object.values(LIFETIME_KEYS).includes(inputKey);
    if (isLifetimeKey) {
       // Logic: Cannot reuse specific lifetime key ever
       const alreadyUsed = data.license.usedKeys?.some(k => k.key === inputKey);
       if (alreadyUsed) return 'duplicate';

       const now = new Date();
       const newExp = new Date(now);
       newExp.setFullYear(newExp.getFullYear() + 100); // Add 100 years

       const newUsedKeys = [...(data.license.usedKeys || []), { key: inputKey, year: currentYear }];
       setData(prev => ({
         ...prev,
         license: { isActive: true, expirationDate: newExp.toISOString(), usedKeys: newUsedKeys }
       }));
       return 'success';
    }

    return 'invalid';
  };

  return (
    <AppContext.Provider value={{
      data, setData, addClient, updateClient, deleteClient,
      addPlan, updatePlan, deletePlan, saveSettings, activateLicense,
      checkLicense, navigate: setCurrentView, currentView, isLicenseValid,
      addMessageTemplate, addAccount, deleteAccount, updateAccount
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- Helper Components ---

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  totalValue,
  title
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (type: 'total' | 'partial', amount?: number) => void,
  totalValue: number,
  title: string
}) => {
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <p className="mb-4 text-gray-600">Valor Total/Restante: R$ {totalValue.toFixed(2)}</p>
        
        <div className="space-y-3">
          <button 
            onClick={() => onConfirm('total')}
            className="w-full bg-green-600 text-white p-3 rounded font-bold"
          >
            Pagar Total (R$ {totalValue.toFixed(2)})
          </button>
          
          <div className="border-t pt-3">
            <p className="text-sm font-semibold mb-2">Pagar Parcial:</p>
            <div className="flex space-x-2">
              <span className="p-2 bg-gray-100 border border-r-0 rounded-l">R$</span>
              <input 
                type="number"
                className="w-full p-2 border rounded-r"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                if(Number(amount) > 0) onConfirm('partial', Number(amount));
              }}
              className="w-full bg-blue-600 text-white p-3 rounded font-bold mt-2"
              disabled={!amount || Number(amount) <= 0}
            >
              Confirmar Parcial
            </button>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 p-3 rounded mt-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const SearchFilterBar = ({ 
  searchTerm, 
  setSearchTerm, 
  filterValue, 
  setFilterValue, 
  filterOptions,
  placeholder = "Pesquisar..."
}: {
  searchTerm: string,
  setSearchTerm: (s: string) => void,
  filterValue?: string,
  setFilterValue?: (v: string) => void,
  filterOptions?: {label: string, value: string}[],
  placeholder?: string
}) => (
  <div className="flex flex-col md:flex-row gap-2 mb-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      <input 
        className="w-full pl-10 p-2 border rounded"
        placeholder={placeholder}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
    </div>
    {filterOptions && setFilterValue && (
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <select
          className="pl-10 p-2 border rounded bg-white w-full md:w-auto"
          value={filterValue}
          onChange={e => setFilterValue(e.target.value)}
        >
          {filterOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )}
  </div>
);

const LicenseLockMessage = () => (
  <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4" role="alert">
    <p className="font-bold">Licença Necessária</p>
    <p>Para ativar as opções de Backup e restauração de backup, cadastro ilimitado de clientes e cadastro dos planos, alteração na imagem e dados do perfil da empresa, ative a licença.</p>
  </div>
);

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const { data } = useContext(AppContext);
  useEffect(() => {
    const timer = setTimeout(onFinish, 5000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-4">
      <img 
        src={data.settings.profileImage || SPLASH_IMAGE} 
        alt="Splash" 
        className="w-full max-w-md object-contain rounded-lg shadow-2xl mb-8 animate-fade-in"
      />
      <h1 className="text-2xl font-bold text-brand-blue animate-pulse">Carregando Sistema...</h1>
    </div>
  );
};

// --- Views ---

const Dashboard = () => {
  const { data, isLicenseValid } = useContext(AppContext);
  const { clients, accountsPayable, settings } = data;
  const [paymentFilter, setPaymentFilter] = useState<'today' | '7days' | '30days' | 'overdue'>('overdue');
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const alertDays = settings.dashboardAlertDays || 30; 
  const accountsDays = settings.dashboardAccountsDays || 7;
  const showClientAlerts = settings.dashboardShowClientAlerts ?? true;
  const showBirthdays = settings.dashboardShowBirthdays ?? true;
  const birthdayDays = settings.dashboardBirthdayDays || 0;
  const showPaymentMonitoring = settings.dashboardShowPaymentMonitoring ?? true;

  const receivables = clients.reduce((acc, client) => {
    if (client.paymentStatus === 'paid') return acc;
    const targetDateStr = client.paymentDate || client.dueDate;
    const targetDate = parseLocalDate(targetDateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= alertDays) {
      const plan = data.plans.find(p => p.id === client.planId);
      const value = client.amountOwed !== undefined ? client.amountOwed : (plan ? plan.price : 0);
      return acc + value;
    }
    return acc;
  }, 0);

  const licenseExp = new Date(data.license.expirationDate);
  const licenseDiff = Math.ceil((licenseExp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const showLicenseAlert = data.license.isActive && licenseDiff <= 3;

  const upcomingBirthdays = clients.filter(c => {
    if (!c.birthDate) return false;
    const [year, month, day] = c.birthDate.split('-').map(Number);
    const bdayThisYear = new Date(today.getFullYear(), month - 1, day);
    const bdayNextYear = new Date(today.getFullYear() + 1, month - 1, day);
    let targetBday = bdayThisYear;
    if (bdayThisYear < today) {
       targetBday = bdayNextYear;
    }
    const diffTime = targetBday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= birthdayDays;
  }).sort((a, b) => {
     const [yA, mA, dA] = a.birthDate.split('-').map(Number);
     const [yB, mB, dB] = b.birthDate.split('-').map(Number);
     const dateA = new Date(today.getFullYear(), mA - 1, dA);
     const dateB = new Date(today.getFullYear(), mB - 1, dB);
     if (dateA < today) dateA.setFullYear(today.getFullYear() + 1);
     if (dateB < today) dateB.setFullYear(today.getFullYear() + 1);
     return dateA.getTime() - dateB.getTime();
  });

  const sendBirthdayMessage = (client: Client) => {
    const template = data.messageTemplates.find(t => t.type === 'birthday');
    if (template) {
      const text = template.content.replace('{nome}', client.name);
      const url = `https://wa.me/${client.whatsapp}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  const urgentClients = clients.filter(c => {
    if (!c.dueDate) return false;
    const [year, month, day] = c.dueDate.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day); 
    if (c.dueTime) {
      const [hours, minutes] = c.dueTime.split(':').map(Number);
      dueDate.setHours(hours, minutes, 0, 0);
    } else {
      dueDate.setHours(23, 59, 59, 999);
    }
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime(); 
    const hoursDiff = diffMs / (1000 * 60 * 60);
    return isLicenseValid && hoursDiff > 0 && hoursDiff <= 24;
  });

  const accountsDue = accountsPayable.flatMap(acc => 
    acc.installments.map(inst => ({ ...inst, accountName: acc.name }))
  ).filter(inst => inst.status === 'pending').filter(inst => {
    const due = parseLocalDate(inst.dueDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= accountsDays; 
  }).sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());

  // Logic for "Clientes em Acompanhamento de Pagamento" Card
  const filteredPaymentClients = clients.filter(client => {
    if (client.paymentStatus === 'paid') return false; // Only show pending

    // Use Payment Date if exists, else Due Date
    const targetDateStr = client.paymentDate || client.dueDate;
    const targetDate = parseLocalDate(targetDateStr);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (paymentFilter === 'overdue') {
      return diffDays < 0;
    } else if (paymentFilter === 'today') {
      return diffDays === 0;
    } else if (paymentFilter === '7days') {
      return diffDays > 0 && diffDays <= 7;
    } else if (paymentFilter === '30days') {
      return diffDays > 0 && diffDays <= 30;
    }
    return false;
  }).sort((a, b) => {
    const dateA = parseLocalDate(a.paymentDate || a.dueDate);
    const dateB = parseLocalDate(b.paymentDate || b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });


  return (
    <div className="p-4 space-y-4 pb-20 md:pb-4">
      <div className="flex items-center space-x-4 mb-6">
        <img 
          src={data.settings.profileImage} 
          alt="Logo" 
          className="w-16 h-16 rounded-full object-cover border-2 border-brand-blue"
        />
        <h1 className="text-2xl font-bold text-brand-blue">{data.settings.companyName}</h1>
      </div>

      {showLicenseAlert && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">Atenção!</p>
          <p>Sua licença vence em {licenseDiff} dias.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex justify-between items-center">
            <h3 className="text-gray-500 text-sm font-medium">A Receber ({alertDays} dias)</h3>
            <DollarSign className="text-green-500" size={20} />
          </div>
          <p className="text-2xl font-bold mt-2">R$ {receivables.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Baseado na Data de Pagamento</p>
        </div>
        
        {showClientAlerts && isLicenseValid && (
         <div className={`bg-white p-4 rounded-lg shadow border-l-4 border-red-500 ${urgentClients.length > 0 ? 'animate-pulse ring-2 ring-red-300' : ''}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-red-600 text-sm font-bold">Vencendo em 24h</h3>
            <Clock className="text-red-500" size={20} />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-700">{urgentClients.length} Clientes</p>
          {urgentClients.length > 0 && (
             <div className="mt-2 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded">
               {urgentClients.slice(0, 3).map(c => <div key={c.id}>• {c.name}</div>)}
               {urgentClients.length > 3 && <div>...</div>}
             </div>
          )}
        </div>
        )}

        {showBirthdays && isLicenseValid && (
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-400">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-gray-500 text-sm font-medium">
                 Aniversariantes {birthdayDays > 0 ? `(Próx. ${birthdayDays} dias)` : '(Hoje)'}
              </h3>
              <Calendar className="text-blue-400" size={20} />
            </div>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum aniversariante</p>
            ) : (
              <div className="space-y-2">
                {upcomingBirthdays.slice(0, 3).map(client => {
                  const [y, m, d] = client.birthDate.split('-').map(Number);
                  const bday = new Date(today.getFullYear(), m - 1, d);
                  const isToday = bday.getDate() === today.getDate() && bday.getMonth() === today.getMonth();

                  return (
                    <div key={client.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        {client.profileImage ? (
                            <img src={client.profileImage} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                            <Users size={16} />
                        )}
                        <div className="flex flex-col">
                           <span className="text-sm font-medium">{client.name}</span>
                           <span className="text-xs text-gray-500">
                              {d}/{m} {isToday && <span className="text-green-600 font-bold">(Hoje)</span>}
                           </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => sendBirthdayMessage(client)}
                        className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        Parabéns
                      </button>
                    </div>
                  );
                })}
                {upcomingBirthdays.length > 3 && <p className="text-xs text-center text-gray-400">Ver mais...</p>}
              </div>
            )}
          </div>
        )}
      </div>

       {/* Clientes em Acompanhamento de Pagamento - NEW CARD */}
       {showPaymentMonitoring && (
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-2 md:mb-0">
              <Monitor className="text-blue-600 mr-2" size={20}/>
              <h3 className="font-bold text-lg text-gray-800">Clientes em Acompanhamento de Pagamento</h3>
            </div>
            <select 
              className="p-2 border rounded text-sm bg-gray-50"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
            >
              <option value="overdue">Clientes em Débito (Vencidos)</option>
              <option value="today">Vencimento Hoje</option>
              <option value="7days">Próximos 7 Dias</option>
              <option value="30days">Próximos 30 Dias</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            {filteredPaymentClients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>Nenhum cliente encontrado para este filtro.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="p-3">Nome do Cliente</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Data Pagamento</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPaymentClients.map(client => {
                    const plan = data.plans.find(p => p.id === client.planId);
                    const amount = client.amountOwed !== undefined ? client.amountOwed : (plan ? plan.price : 0);
                    const paymentDateStr = client.paymentDate || client.dueDate;
                    const paymentDate = parseLocalDate(paymentDateStr);
                    
                    // Visual Indicators Logic
                    const diffTime = paymentDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let nameStyle = "text-gray-800 font-medium";
                    if (diffDays < 0) nameStyle = "text-red-600 animate-pulse font-bold"; // Overdue
                    else if (diffDays === 0) nameStyle = "text-orange-500 font-bold"; // Today
                    else if (diffDays > 0) nameStyle = "text-green-600 font-bold"; // Future

                    return (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center">
                            {client.profileImage && (
                              <img src={client.profileImage} className="w-8 h-8 rounded-full object-cover mr-2" />
                            )}
                            <span className={nameStyle}>{client.name}</span>
                          </div>
                        </td>
                        <td className="p-3">R$ {amount.toFixed(2)}</td>
                        <td className="p-3">
                          {paymentDate.toLocaleDateString('pt-BR')}
                          {client.paymentDate ? <span className="text-xs text-gray-400 ml-1">(Definida)</span> : <span className="text-xs text-gray-400 ml-1">(Plano)</span>}
                        </td>
                        <td className="p-3">
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
                            A Pagar
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
       )}

      {settings.dashboardShowAccounts && (isLicenseValid || data.accountsPayable.length > 0) && (
        <div className="bg-white p-4 rounded-lg shadow mt-6">
          <div className="flex items-center mb-4 text-red-600">
            <AlertOctagon className="mr-2" size={20} />
            <h3 className="font-bold text-lg">Contas a Pagar (Próximos {accountsDays} dias)</h3>
          </div>
          {accountsDue.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma conta próxima do vencimento.</p>
          ) : (
             <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2">Vencimento</th>
                      <th className="p-2">Conta</th>
                      <th className="p-2">Parcela</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsDue.map(inst => {
                       const isLate = parseLocalDate(inst.dueDate) < today;
                       return (
                        <tr key={inst.id} className="border-t">
                          <td className={`p-2 ${isLate ? 'text-red-600 font-bold' : ''}`}>
                             {parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-2 font-medium">{inst.accountName}</td>
                          <td className="p-2">{inst.number}</td>
                          <td className="p-2">R$ {inst.value.toFixed(2)}</td>
                          <td className="p-2">
                            {isLate ? <span className="bg-red-100 text-red-800 px-1 rounded text-xs">Vencido</span> : <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">A Vencer</span>}
                          </td>
                        </tr>
                       );
                    })}
                  </tbody>
                </table>
             </div>
          )}
        </div>
      )}
    </div>
  );
};

const ClientList = () => {
  const { data, addClient, updateClient, deleteClient, isLicenseValid, addMessageTemplate, navigate } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>({});
  const [showForm, setShowForm] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  
  const [messageModal, setMessageModal] = useState<{isOpen: boolean, client: Client | null}>({isOpen: false, client: null});
  const [showTemplates, setShowTemplates] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredClients = data.clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          client.whatsapp.includes(searchTerm);
    const matchesPlan = filterPlan === 'all' || client.planId === filterPlan;
    return matchesSearch && matchesPlan;
  });

  const handleSave = (createAnother = false) => {
    if (!editingClient.name || !editingClient.whatsapp || !editingClient.planId || !editingClient.dueDate) {
      alert("Preencha os campos obrigatórios");
      return;
    }

    const plan = data.plans.find(p => p.id === editingClient.planId);
    const initialAmount = editingClient.amountOwed !== undefined ? editingClient.amountOwed : (plan ? plan.price : 0);

    const clientData: Client = {
      id: editingClient.id || Date.now().toString(),
      name: editingClient.name,
      whatsapp: editingClient.whatsapp,
      planId: editingClient.planId,
      dueDate: editingClient.dueDate,
      dueTime: editingClient.dueTime,
      paymentDate: editingClient.paymentDate,
      birthDate: editingClient.birthDate || '',
      paymentStatus: editingClient.paymentStatus || 'pending',
      profileImage: editingClient.profileImage,
      notes: editingClient.notes || '',
      createdAt: editingClient.createdAt || new Date().toISOString().split('T')[0],
      amountOwed: initialAmount
    };

    if (isEditing) {
      updateClient(clientData);
      setShowForm(false);
    } else {
      addClient(clientData);
      if (createAnother) {
        setEditingClient({
          paymentStatus: 'pending',
          dueDate: todayStr,
          amountOwed: 0
        });
      } else {
        setShowForm(false);
      }
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleAddNew = () => {
    if (!isLicenseValid && data.clients.length >= 5) {
      return; 
    }
    setEditingClient({
      paymentStatus: 'pending',
      dueDate: todayStr
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingClient(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportContact = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel', 'icon'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts.length) {
          const contact = contacts[0];
          const name = contact.name?.[0];
          const tel = contact.tel?.[0];
          const icon = contact.icon?.[0];

          setEditingClient(prev => ({
            ...prev,
            name: name || prev.name,
            whatsapp: tel ? tel.replace(/\D/g, '') : prev.whatsapp
          }));

          if (icon) {
              const reader = new FileReader();
              reader.onload = (e) => setEditingClient(prev => ({...prev, profileImage: e.target?.result as string}));
              reader.readAsDataURL(icon);
          }
        }
      } catch (ex) {
        console.error("Erro ao importar contato", ex);
      }
    } else {
      alert("A importação de contatos não é suportada neste navegador/dispositivo. Tente usar no celular (Android) via Chrome.");
    }
  };

  const getMedals = (createdAt?: string) => {
    if (!createdAt) return null;
    const created = parseLocalDate(createdAt);
    const today = new Date();
    const diffYears = today.getFullYear() - created.getFullYear();
    const isAnniversaryPassed = today.getMonth() > created.getMonth() || (today.getMonth() === created.getMonth() && today.getDate() >= created.getDate());
    const years = isAnniversaryPassed ? diffYears : diffYears - 1;

    if (years >= 4) return "🥉🥈🥇";
    if (years === 3) return "🥇";
    if (years === 2) return "🥈";
    if (years === 1) return "🥉";
    return null;
  };

  const isBirthdayToday = (birthDate?: string) => {
    if (!birthDate) return false;
    const [y, m, d] = birthDate.split('-').map(Number);
    const today = new Date();
    return today.getMonth() === m - 1 && today.getDate() === d;
  };

  const openMessageModal = (client: Client) => {
    setMessageModal({ isOpen: true, client });
    setShowTemplates(false);
  };

  const sendDirectMessage = () => {
    if (messageModal.client) {
      window.open(`https://wa.me/${messageModal.client.whatsapp}`, '_blank');
      setMessageModal({ isOpen: false, client: null });
    }
  };

  const selectTemplate = (template: MessageTemplate) => {
    if (messageModal.client) {
      let text = template.content;
      const plan = data.plans.find(p => p.id === messageModal.client?.planId);
      
      text = text.replace('{nome}', messageModal.client.name);
      text = text.replace('{data}', parseLocalDate(messageModal.client.dueDate).toLocaleDateString('pt-BR'));
      text = text.replace('{valor}', plan ? `R$ ${plan.price.toFixed(2)}` : '');
      
      window.open(`https://wa.me/${messageModal.client.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
      setMessageModal({ isOpen: false, client: null });
    }
  };

  if (showForm) {
    return (
      <div className="p-4 pb-20 md:pb-4">
        <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h2>
        <div className="bg-white p-4 rounded shadow space-y-4">
          
          <div className="flex flex-col items-center mb-4">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mb-2 relative">
              {editingClient.profileImage ? (
                <img src={editingClient.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Users size={32} className="text-gray-400" />
              )}
              <input 
                 type="file" 
                 accept="image/*"
                 onChange={handleImageUpload}
                 className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-xs text-blue-600">Toque para alterar foto</span>
          </div>

           <button 
             onClick={handleImportContact}
             className="w-full bg-blue-50 text-blue-600 border border-blue-200 p-2 rounded flex items-center justify-center font-semibold mb-2"
           >
              <UserPlus size={18} className="mr-2" /> Importar Contato (Agenda)
           </button>

          <input 
            className="w-full p-2 border rounded"
            placeholder="Nome Completo *"
            value={editingClient.name || ''}
            onChange={e => setEditingClient({...editingClient, name: e.target.value})}
          />
          <input 
            className="w-full p-2 border rounded"
            placeholder="WhatsApp (apenas números) *"
            value={editingClient.whatsapp || ''}
            onChange={e => setEditingClient({...editingClient, whatsapp: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
               <label className="text-xs text-gray-500">Data de Nascimento</label>
               <input 
                type="date"
                className="w-full p-2 border rounded"
                value={editingClient.birthDate || ''}
                onChange={e => setEditingClient({...editingClient, birthDate: e.target.value})}
               />
            </div>
             <div>
               <label className="text-xs text-gray-500">Status do Pagamento</label>
               <select
                 className="w-full p-2 border rounded"
                 value={editingClient.paymentStatus || 'pending'}
                 onChange={e => setEditingClient({...editingClient, paymentStatus: e.target.value as any})}
               >
                 <option value="pending">A Pagar</option>
                 <option value="paid">Pago</option>
               </select>
            </div>
          </div>

          <div>
             <label className="text-xs text-gray-500">Data do Pagamento (Opcional)</label>
             <input 
               type="date"
               className="w-full p-2 border rounded"
               value={editingClient.paymentDate || ''}
               onChange={e => setEditingClient({...editingClient, paymentDate: e.target.value})}
             />
             <p className="text-xs text-gray-400 mt-1">Preencha se a data de pagamento for diferente do vencimento do plano.</p>
          </div>

          <select 
            className="w-full p-2 border rounded"
            value={editingClient.planId || ''}
            onChange={e => setEditingClient({...editingClient, planId: e.target.value})}
          >
            <option value="">Selecione um Plano *</option>
            {data.plans.map(p => (
              <option key={p.id} value={p.id}>{p.name} - R$ {p.price}</option>
            ))}
          </select>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
               <label className="text-xs text-gray-500">Vencimento Inicial (Plano) *</label>
               <input 
                type="date"
                className="w-full p-2 border rounded"
                value={editingClient.dueDate || ''}
                onChange={e => setEditingClient({...editingClient, dueDate: e.target.value})}
              />
            </div>
            <div>
               <label className="text-xs text-gray-500">Hora (Opcional)</label>
               <input 
                type="time"
                className="w-full p-2 border rounded"
                value={editingClient.dueTime || ''}
                onChange={e => setEditingClient({...editingClient, dueTime: e.target.value})}
              />
            </div>
          </div>

          <div className="flex space-x-2 mt-4">
             <button 
              onClick={() => handleSave(false)}
              className="flex-1 bg-brand-blue text-white p-2 rounded flex items-center justify-center"
            >
              <Save size={18} className="mr-2" /> Salvar
            </button>
            {!isEditing && (
              <button 
                onClick={() => handleSave(true)}
                className="flex-1 bg-green-600 text-white p-2 rounded flex items-center justify-center"
              >
                <Plus size={18} className="mr-2" /> Salvar e Novo
              </button>
            )}
            <button 
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-300 text-gray-800 p-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 md:pb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Gerenciar Clientes</h2>
        {!isLicenseValid && data.clients.length >= 5 ? (
          <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">Limite (5) atingido</span>
        ) : (
          <button 
            onClick={handleAddNew}
            className="bg-brand-blue text-white p-2 rounded-full shadow-lg"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {!isLicenseValid && data.clients.length >= 5 && <LicenseLockMessage />}

      <SearchFilterBar 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm}
        filterValue={filterPlan}
        setFilterValue={setFilterPlan}
        filterOptions={[
          {label: 'Todos os Planos', value: 'all'},
          ...data.plans.map(p => ({label: p.name, value: p.id}))
        ]}
      />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredClients.map(client => {
          const plan = data.plans.find(p => p.id === client.planId);
          const medals = getMedals(client.createdAt);
          const isBday = isBirthdayToday(client.birthDate);
          
          return (
            <div key={client.id} className="p-4 border-b last:border-0 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {client.profileImage ? (
                      <img src={client.profileImage} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-full h-full p-2 text-gray-400" />
                    )}
                 </div>
                 <div>
                    <h3 className="font-bold flex items-center">
                      {client.name}
                      {medals && <span className="ml-1 text-sm">{medals}</span>}
                      {isBday && <Cake size={16} className="ml-1 text-pink-500" />}
                    </h3>
                    <p className="text-sm text-gray-600">{plan?.name} - {parseLocalDate(client.dueDate).toLocaleDateString('pt-BR')}</p>
                 </div>
              </div>
              <div className="flex space-x-2">
                 <button onClick={() => openMessageModal(client)} className="text-green-500 p-2 hover:bg-green-50 rounded">
                  <MessageSquare size={20} />
                </button>
                <button onClick={() => handleEdit(client)} className="text-blue-500 p-2 hover:bg-blue-50 rounded">
                  <Edit2 size={20} />
                </button>
                <button onClick={() => deleteClient(client.id)} className="text-red-500 p-2 hover:bg-red-50 rounded">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          );
        })}
        {filteredClients.length === 0 && (
          <p className="p-4 text-center text-gray-500">Nenhum cliente encontrado.</p>
        )}
      </div>

      {messageModal.isOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-sm p-6">
               <h3 className="text-lg font-bold mb-4">Enviar Mensagem</h3>
               <p className="mb-4 text-sm text-gray-600">Para: {messageModal.client?.name}</p>
               
               {!showTemplates ? (
                  <div className="space-y-3">
                     <button 
                        onClick={sendDirectMessage}
                        className="w-full bg-green-600 text-white p-3 rounded flex items-center justify-center"
                     >
                        <MessageCircle className="mr-2" /> Escrever Personalizada
                     </button>
                     <button 
                        onClick={() => setShowTemplates(true)}
                        className="w-full bg-blue-600 text-white p-3 rounded flex items-center justify-center"
                     >
                        <SettingsIcon className="mr-2" /> Usar Modelo Pronto
                     </button>
                     <button 
                       onClick={() => setMessageModal({isOpen: false, client: null})}
                       className="w-full bg-gray-200 text-gray-800 p-3 rounded"
                     >
                        Cancelar
                     </button>
                  </div>
               ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                     <div className="flex justify-between items-center mb-2">
                       <h4 className="font-semibold text-sm">Selecione o Modelo:</h4>
                       <button onClick={() => navigate('communication')} className="text-xs text-blue-500 flex items-center">
                         <Plus size={12} className="mr-1"/> Criar Novo
                       </button>
                     </div>
                     {data.messageTemplates.map(t => (
                        <button 
                           key={t.id}
                           onClick={() => selectTemplate(t)}
                           className="w-full text-left p-2 border rounded hover:bg-gray-50 text-sm"
                        >
                           {t.title}
                        </button>
                     ))}
                     <button 
                       onClick={() => setShowTemplates(false)}
                       className="w-full bg-gray-200 text-gray-800 p-2 rounded mt-4 text-sm"
                     >
                        Voltar
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </div>
  );
};

const PlanList = () => {
  const { data, addPlan, updatePlan, deletePlan, isLicenseValid } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan>>({});
  const [showForm, setShowForm] = useState(false);

  const handleSave = () => {
    if (!editingPlan.name || !editingPlan.price) return;

    const planData: Plan = {
      id: editingPlan.id || Date.now().toString(),
      name: editingPlan.name,
      price: Number(editingPlan.price),
      description: editingPlan.description || ''
    };

    if (isEditing) {
      updatePlan(planData);
    } else {
      addPlan(planData);
    }
    setShowForm(false);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleAddNew = () => {
    if (!isLicenseValid && data.plans.length >= 5) return;
    setEditingPlan({});
    setIsEditing(false);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="p-4 pb-20 md:pb-4">
        <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar Plano' : 'Novo Plano'}</h2>
        <div className="bg-white p-4 rounded shadow space-y-4">
          <input 
            className="w-full p-2 border rounded"
            placeholder="Nome do Plano"
            value={editingPlan.name || ''}
            onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
          />
          <div className="flex items-center">
            <span className="p-2 bg-gray-100 border border-r-0 rounded-l">R$</span>
            <input 
              type="number"
              className="w-full p-2 border rounded-r"
              placeholder="Valor Mensal"
              value={editingPlan.price || ''}
              onChange={e => setEditingPlan({...editingPlan, price: parseFloat(e.target.value)})}
            />
          </div>
          <textarea 
            className="w-full p-2 border rounded"
            placeholder="Descrição"
            value={editingPlan.description || ''}
            onChange={e => setEditingPlan({...editingPlan, description: e.target.value})}
          />
          <div className="flex space-x-2">
            <button 
              onClick={handleSave}
              className="flex-1 bg-brand-blue text-white p-2 rounded"
            >
              Salvar
            </button>
            <button 
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-300 text-gray-800 p-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 md:pb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Gerenciar Planos</h2>
        {!isLicenseValid && data.plans.length >= 5 ? (
          <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">Limite (5) atingido</span>
        ) : (
          <button 
            onClick={handleAddNew}
            className="bg-brand-blue text-white p-2 rounded-full shadow-lg"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {!isLicenseValid && data.plans.length >= 5 && <LicenseLockMessage />}

      <div className="space-y-4">
        {data.plans.map(plan => (
          <div key={plan.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <p className="text-brand-blue font-bold">R$ {plan.price.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{plan.description}</p>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => handleEdit(plan)} className="text-blue-500 p-2">
                <Edit2 size={20} />
              </button>
              <button onClick={() => deletePlan(plan.id)} className="text-red-500 p-2">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ClientExpirationsList = () => {
  const { data, updateClient, isLicenseValid, navigate } = useContext(AppContext);
  const [messageModal, setMessageModal] = useState<{isOpen: boolean, client: Client | null}>({isOpen: false, client: null});
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Payment Modal (Partial/Total)
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, client: Client | null}>({isOpen: false, client: null});

  // Charge Modal
  const [chargeModal, setChargeModal] = useState<{isOpen: boolean, client: Client | null}>({isOpen: false, client: null});
  const [pixPayload, setPixPayload] = useState('');

  const getStatus = (dueDate: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = parseLocalDate(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Vencido", color: "bg-red-100 text-red-800", value: 'late' };
    if (diffDays === 0) return { label: "Vencendo Hoje", color: "bg-yellow-100 text-yellow-800", value: 'today' };
    return { label: "A Vencer", color: "bg-green-100 text-green-800", value: 'future' };
  };

  const filteredClients = data.clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStatus(client.dueDate).value;
    const matchesFilter = filterStatus === 'all' || 
                          (filterStatus === 'pending' && client.paymentStatus === 'pending') ||
                          (filterStatus === 'paid' && client.paymentStatus === 'paid') ||
                          (filterStatus === 'late' && status === 'late');
    return matchesSearch && matchesFilter;
  });

  const sortedClients = [...filteredClients].sort((a, b) => 
    parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime()
  );

  const handleRenew = (client: Client, days: number) => {
    const plan = data.plans.find(p => p.id === client.planId);
    const price = plan ? plan.price : 0;
    const multiplier = Math.floor(days / 30);
    const addedValue = price * multiplier;

    const currentDebt = client.paymentStatus === 'pending' ? (client.amountOwed || 0) : 0;
    const totalDebt = currentDebt + addedValue;

    const isCash = window.confirm(`Renovando por ${days} dias.\nValor Adicional: R$ ${addedValue.toFixed(2)}\n\nTotal Acumulado (se Pendente): R$ ${totalDebt.toFixed(2)}\n\nO cliente realizou o pagamento?\n\nOK = Sim (Pago)\nCancelar = Não (À Pagar/Pendente)`);
    const currentDue = parseLocalDate(client.dueDate);
    const today = new Date();
    const baseDate = currentDue > today ? currentDue : today;
    
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);

    updateClient({
      ...client,
      dueDate: newDate.toISOString().split('T')[0],
      paymentStatus: isCash ? 'paid' : 'pending',
      amountOwed: isCash ? 0 : totalDebt
    });
    alert(`Renovado para ${newDate.toLocaleDateString('pt-BR')} (${isCash ? 'Pago' : 'Pendente'})`);
  };

  // Charge Logic (Open Modal)
  const handleCharge = (client: Client) => {
     setChargeModal({ isOpen: true, client });
     const plan = data.plans.find(p => p.id === client.planId);
     const amount = client.amountOwed !== undefined ? client.amountOwed : (plan ? plan.price : 0);
     
     if (data.settings.pixKey) {
       // Generate Pix string
       const payload = generatePix(
         data.settings.pixKey, 
         data.settings.pixName || data.settings.companyName, 
         'CIDADE', // Default city as usually not strictly validated for static codes or user didn't input
         amount
       );
       setPixPayload(payload);
     } else {
       setPixPayload('');
     }
  };

  const handleDownloadQr = () => {
    // Basic trick to download the img src
    const img = document.getElementById('qr-image') as HTMLImageElement;
    if (img) {
      const link = document.createElement('a');
      link.href = img.src;
      link.download = `qrcode_pix.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendChargeWhatsApp = () => {
    if (!chargeModal.client) return;
    const client = chargeModal.client;
    const plan = data.plans.find(p => p.id === client.planId);
    const amount = client.amountOwed !== undefined ? client.amountOwed : (plan ? plan.price : 0);
    
    let message = `Olá ${client.name}, segue a cobrança.\n\n`;
    message += `Valor: R$ ${amount.toFixed(2)}\n`;
    if (pixPayload) {
      message += `Pagamento via Pix (Copia e Cola):\n${pixPayload}\n\n`;
      message += `Chave Pix: ${data.settings.pixKey}\n`;
      message += `Nome: ${data.settings.pixName || data.settings.companyName}`;
    } else {
      message += "Favor entrar em contato para pagamento.";
    }

    window.open(`https://wa.me/${client.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
    setChargeModal({ isOpen: false, client: null });
  };

  const handlePaymentClick = (client: Client) => {
    if (client.paymentStatus === 'paid') {
      // Logic to unpay? Or just toggle back to pending?
      // For now toggle back to pending to reverse mistake
       if(window.confirm("Marcar como pendente?")) {
         updateClient({ ...client, paymentStatus: 'pending' });
       }
    } else {
      setPaymentModal({ isOpen: true, client });
    }
  };

  const confirmPayment = (type: 'total' | 'partial', amount?: number) => {
    const client = paymentModal.client;
    if (!client) return;

    if (type === 'total') {
      updateClient({
        ...client,
        paymentStatus: 'paid',
        amountOwed: 0
      });
    } else if (type === 'partial' && amount) {
      const current = client.amountOwed || 0;
      updateClient({
        ...client,
        paymentStatus: 'pending',
        amountOwed: Math.max(0, current - amount)
      });
    }
    setPaymentModal({ isOpen: false, client: null });
  };

  const openMessageModal = (client: Client) => {
    setMessageModal({ isOpen: true, client });
    setShowTemplates(false);
  };

  const sendDirectMessage = () => {
    if (messageModal.client) {
      window.open(`https://wa.me/${messageModal.client.whatsapp}`, '_blank');
      setMessageModal({ isOpen: false, client: null });
    }
  };

  const selectTemplate = (template: MessageTemplate) => {
    if (messageModal.client) {
      let text = template.content;
      const plan = data.plans.find(p => p.id === messageModal.client?.planId);
      const amount = messageModal.client.amountOwed !== undefined ? messageModal.client.amountOwed : (plan ? plan.price : 0);

      text = text.replace('{nome}', messageModal.client.name);
      text = text.replace('{data}', parseLocalDate(messageModal.client.dueDate).toLocaleDateString('pt-BR'));
      text = text.replace('{valor}', `R$ ${amount.toFixed(2)}`);
      
      window.open(`https://wa.me/${messageModal.client.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
      setMessageModal({ isOpen: false, client: null });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
         <h2 className="text-lg font-bold text-gray-700">Vencimentos (Clientes)</h2>
         <button 
           onClick={() => navigate('clients')}
           className="bg-green-600 text-white px-3 py-2 rounded text-sm flex items-center"
         >
           <Plus size={16} className="mr-1" /> Novo Cliente
         </button>
      </div>

      <SearchFilterBar 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm}
        filterValue={filterStatus}
        setFilterValue={setFilterStatus}
        filterOptions={[
          {label: 'Todos', value: 'all'},
          {label: 'Pendentes', value: 'pending'},
          {label: 'Pagos', value: 'paid'},
          {label: 'Vencidos', value: 'late'}
        ]}
      />
      
      <div className="space-y-4">
        {sortedClients.map(client => {
          const status = getStatus(client.dueDate);
          const plan = data.plans.find(p => p.id === client.planId);
          const amount = client.amountOwed !== undefined ? client.amountOwed : (plan ? plan.price : 0);

          return (
            <div key={client.id} className={`bg-white p-4 rounded shadow border-l-4 ${status.label === 'Vencido' ? 'border-red-500' : status.label === 'Vencendo Hoje' ? 'border-yellow-500' : 'border-green-500'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold flex items-center">
                     {client.name}
                     <span className={`ml-2 text-xs px-2 py-1 rounded ${status.color}`}>{status.label}</span>
                  </h3>
                  <p className="text-sm text-gray-500">O Plano Vence: {parseLocalDate(client.dueDate).toLocaleDateString('pt-BR')}</p>
                  
                  {client.paymentStatus === 'pending' && client.paymentDate && (
                    <p className="text-sm font-bold text-red-600">
                       Pagamento Vence: {parseLocalDate(client.paymentDate).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  <p className="text-sm font-bold text-gray-700 mt-1">Plano: {plan?.name}</p>
                  {client.paymentStatus !== 'paid' && (
                     <p className="text-xs text-red-600 font-bold mt-1">
                        Valor Pendente: R$ {amount.toFixed(2)}
                     </p>
                  )}
                </div>
                <div className="flex space-x-2">
                   <button 
                     onClick={() => handlePaymentClick(client)}
                     className={`px-2 py-1 rounded text-xs font-bold border ${client.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                   >
                      {client.paymentStatus === 'paid' ? 'Pago' : 'Devendo'}
                   </button>
                   <button onClick={() => openMessageModal(client)} className="text-blue-500">
                     <MessageCircle size={24} />
                   </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex space-x-2">
                {client.paymentStatus !== 'paid' && (
                  <button onClick={() => handleCharge(client)} className="bg-red-600 text-white text-xs px-3 py-2 rounded flex items-center justify-center font-bold">
                     <DollarSign size={14} className="mr-1" /> Cobrar
                  </button>
                )}
                <div className="flex-1 flex space-x-1">
                  <button onClick={() => handleRenew(client, 30)} className="flex-1 bg-gray-100 text-xs py-2 rounded hover:bg-gray-200">+30 Dias</button>
                  <button onClick={() => handleRenew(client, 60)} className="flex-1 bg-gray-100 text-xs py-2 rounded hover:bg-gray-200">+60 Dias</button>
                  <button onClick={() => handleRenew(client, 90)} className="flex-1 bg-gray-100 text-xs py-2 rounded hover:bg-gray-200">+90 Dias</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

       {/* Payment Modal */}
       <PaymentModal 
         isOpen={paymentModal.isOpen}
         onClose={() => setPaymentModal({ isOpen: false, client: null })}
         onConfirm={confirmPayment}
         totalValue={paymentModal.client ? (paymentModal.client.amountOwed || 0) : 0}
         title={`Recebimento de ${paymentModal.client?.name}`}
       />

       {/* Message Modal */}
       {messageModal.isOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-sm p-6">
               <h3 className="text-lg font-bold mb-4">Enviar Mensagem</h3>
               <p className="mb-4 text-sm text-gray-600">Para: {messageModal.client?.name}</p>
               
               {!showTemplates ? (
                  <div className="space-y-3">
                     <button 
                        onClick={sendDirectMessage}
                        className="w-full bg-green-600 text-white p-3 rounded flex items-center justify-center"
                     >
                        <MessageCircle className="mr-2" /> Escrever Personalizada
                     </button>
                     <button 
                        onClick={() => setShowTemplates(true)}
                        className="w-full bg-blue-600 text-white p-3 rounded flex items-center justify-center"
                     >
                        <SettingsIcon className="mr-2" /> Usar Modelo Pronto
                     </button>
                     <button 
                       onClick={() => setMessageModal({isOpen: false, client: null})}
                       className="w-full bg-gray-200 text-gray-800 p-3 rounded"
                     >
                        Cancelar
                     </button>
                  </div>
               ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                     <div className="flex justify-between items-center mb-2">
                       <h4 className="font-semibold text-sm">Selecione o Modelo:</h4>
                       <button onClick={() => navigate('communication')} className="text-xs text-blue-500 flex items-center">
                         <Plus size={12} className="mr-1"/> Criar Novo
                       </button>
                     </div>
                     {data.messageTemplates.map(t => (
                        <button 
                           key={t.id}
                           onClick={() => selectTemplate(t)}
                           className="w-full text-left p-2 border rounded hover:bg-gray-50 text-sm"
                        >
                           {t.title}
                        </button>
                     ))}
                     <button 
                       onClick={() => setShowTemplates(false)}
                       className="w-full bg-gray-200 text-gray-800 p-2 rounded mt-4 text-sm"
                     >
                        Voltar
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* Charge Modal */}
      {chargeModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-6 relative">
             <button onClick={() => setChargeModal({isOpen: false, client: null})} className="absolute top-2 right-2 text-gray-500">
               <X size={24} />
             </button>
             
             <div className="text-center mb-4">
               <h3 className="text-xl font-bold text-gray-800">Cobrança Pix</h3>
               <p className="text-sm text-gray-500">{chargeModal.client?.name}</p>
             </div>

             {pixPayload ? (
               <div className="flex flex-col items-center">
                  <div className="bg-white p-2 border rounded mb-4">
                     {/* Public API for QR Code */}
                     <img 
                       id="qr-image"
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`} 
                       alt="QR Code Pix"
                       className="w-48 h-48"
                     />
                  </div>
                  <p className="text-xs text-gray-500 mb-2 break-all text-center px-4">
                     Chave: {data.settings.pixKey} <br/>
                     Nome: {data.settings.pixName || data.settings.companyName}
                  </p>
                  
                  <div className="flex flex-col w-full space-y-2">
                     <button 
                        onClick={handleSendChargeWhatsApp}
                        className="w-full bg-green-500 text-white py-2 rounded flex items-center justify-center font-bold"
                     >
                        <MessageCircle className="mr-2" size={18} /> Enviar WhatsApp
                     </button>
                     <button 
                        onClick={handleDownloadQr}
                        className="w-full bg-blue-500 text-white py-2 rounded flex items-center justify-center font-bold"
                     >
                        <Download className="mr-2" size={18} /> Baixar QR Code
                     </button>
                  </div>
               </div>
             ) : (
               <div className="text-center py-6">
                 <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-2" />
                 <p className="text-gray-800 font-bold">Chave Pix não configurada</p>
                 <p className="text-sm text-gray-500 mb-4">Configure sua chave Pix nas configurações para gerar QR Codes.</p>
                 <button onClick={() => navigate('settings')} className="bg-blue-600 text-white px-4 py-2 rounded">Ir para Configurações</button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const AccountsPayableList = () => {
  const { data, addAccount, deleteAccount, updateAccount, isLicenseValid } = useContext(AppContext);
  const [showForm, setShowForm] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<AccountPayable> & { firstDueDate?: string }>({});
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, paid

  // Payment Modal
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, accountId: string | null, installmentId: string | null, total: number}>({isOpen: false, accountId: null, installmentId: null, total: 0});
  
  const generateInstallments = () => {
    if (!newAccount.totalValue || !newAccount.installmentsCount || !newAccount.firstDueDate) return;
    
    // If editing and not regenerating installments, just update info
    if (isEditingAccount && newAccount.id) {
       const existing = data.accountsPayable.find(a => a.id === newAccount.id);
       if (existing) {
         updateAccount({
           ...existing,
           name: newAccount.name || existing.name,
           description: newAccount.description,
           // Note: changing value/count in edit is complex, assuming simplistic edit for now or full overwrite if they changed key fields
         });
         setShowForm(false);
         setNewAccount({});
         setIsEditingAccount(false);
         return;
       }
    }

    const valuePerInst = newAccount.totalValue / newAccount.installmentsCount;
    const installments: AccountInstallment[] = [];
    const firstDate = parseLocalDate(newAccount.firstDueDate);
    
    for (let i = 0; i < newAccount.installmentsCount; i++) {
       const date = new Date(firstDate);
       date.setMonth(date.getMonth() + i);
       installments.push({
         id: Date.now().toString() + i,
         number: i + 1,
         value: valuePerInst,
         originalValue: valuePerInst,
         dueDate: date.toISOString().split('T')[0],
         status: 'pending'
       });
    }
    
    const account: AccountPayable = {
      id: newAccount.id || Date.now().toString(),
      name: newAccount.name || 'Conta',
      description: newAccount.description,
      totalValue: Number(newAccount.totalValue),
      installmentsCount: Number(newAccount.installmentsCount),
      installments: installments
    };
    
    if (isEditingAccount) {
      updateAccount(account);
    } else {
      addAccount(account);
    }
    setShowForm(false);
    setNewAccount({});
    setIsEditingAccount(false);
  };

  const initiatePayment = (accountId: string, installmentId: string, value: number) => {
    setPaymentModal({ isOpen: true, accountId, installmentId, total: value });
  };

  const confirmPayment = (type: 'total' | 'partial', amount?: number) => {
     const { accountId, installmentId } = paymentModal;
     const account = data.accountsPayable.find(a => a.id === accountId);
     if (!account) return;
     
     const updatedAccount = { ...account };
     const instIndex = updatedAccount.installments.findIndex(i => i.id === installmentId);
     if (instIndex === -1) return;
     
     const installment = updatedAccount.installments[instIndex];
     const today = new Date().toISOString().split('T')[0];

     if (type === 'total') {
       updatedAccount.installments[instIndex] = {
           ...installment,
           status: 'paid',
           paidDate: today,
           value: 0 // Remaining is 0
       };
     } else if (type === 'partial' && amount) {
       // Reduce the value remaining
       updatedAccount.installments[instIndex] = {
         ...installment,
         value: Math.max(0, installment.value - amount)
       };
     }
     
     updateAccount(updatedAccount);
     setPaymentModal({isOpen: false, accountId: null, installmentId: null, total: 0});
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!isLicenseValid) {
       alert("Exclusão permitida apenas com licença ativa.");
       return;
    }
    if(window.confirm("Deseja excluir esta conta?")) {
       deleteAccount(id);
    }
  }

  const openNewForm = () => {
     if (!isLicenseValid && data.accountsPayable.length >= 5) {
        alert("Limite de 5 contas na versão gratuita.");
        return;
     }
     setIsEditingAccount(false);
     setNewAccount({});
     setShowForm(true);
  }

  const handleEditCard = (account: AccountPayable) => {
    setNewAccount({
      ...account,
      firstDueDate: account.installments[0]?.dueDate
    });
    setIsEditingAccount(true);
    setShowForm(true);
  }

  const filteredAccounts = data.accountsPayable.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase());
    // Filter logic: Check if ANY installment matches the status? Or if the account has pending installments?
    // Let's filter by: If filter is 'pending', show accounts with pending installments. If 'paid', show accounts fully paid.
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') return matchesSearch && acc.installments.some(i => i.status === 'pending');
    if (filterStatus === 'paid') return matchesSearch && acc.installments.every(i => i.status === 'paid');
    return matchesSearch;
  });

  if (showForm) {
     return (
       <div className="mb-8">
         <h2 className="text-xl font-bold mb-4">{isEditingAccount ? 'Editar Conta' : 'Nova Conta a Pagar'}</h2>
         <div className="bg-white p-4 rounded shadow space-y-3">
            <input 
               className="w-full p-2 border rounded" 
               placeholder="Nome da Conta"
               value={newAccount.name || ''}
               onChange={e => setNewAccount({...newAccount, name: e.target.value})}
            />
             <input 
               className="w-full p-2 border rounded" 
               placeholder="Valor Total"
               type="number"
               value={newAccount.totalValue || ''}
               onChange={e => setNewAccount({...newAccount, totalValue: Number(e.target.value)})}
            />
             <div className="flex space-x-2">
               <input 
                  className="w-full p-2 border rounded" 
                  placeholder="Qtd Parcelas"
                  type="number"
                  value={newAccount.installmentsCount || ''}
                  onChange={e => setNewAccount({...newAccount, installmentsCount: Number(e.target.value)})}
               />
               <input 
                  className="w-full p-2 border rounded" 
                  type="date"
                  placeholder="1ª Vencimento"
                  value={newAccount.firstDueDate || ''}
                  onChange={e => setNewAccount({...newAccount, firstDueDate: e.target.value})}
               />
            </div>
             <input 
               className="w-full p-2 border rounded" 
               placeholder="Descrição (Opcional)"
               value={newAccount.description || ''}
               onChange={e => setNewAccount({...newAccount, description: e.target.value})}
            />
            
            <div className="flex space-x-2 mt-4">
               <button onClick={generateInstallments} className="flex-1 bg-brand-blue text-white p-2 rounded">Salvar</button>
               <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-300 p-2 rounded">Cancelar</button>
            </div>
         </div>
       </div>
     )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-700">Contas a Pagar</h2>
        <button onClick={openNewForm} className="bg-brand-blue text-white p-2 rounded-full shadow">
           <Plus size={24} />
        </button>
      </div>

      <SearchFilterBar 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm}
        filterValue={filterStatus}
        setFilterValue={setFilterStatus}
        filterOptions={[
          {label: 'Todas', value: 'all'},
          {label: 'Pendentes', value: 'pending'},
          {label: 'Quitadas', value: 'paid'}
        ]}
      />
      
      {!isLicenseValid && data.accountsPayable.length >= 5 && <LicenseLockMessage />}

      <div className="space-y-4">
        {filteredAccounts.map(acc => (
          <div key={acc.id} onClick={() => handleEditCard(acc)} className="bg-white rounded shadow p-4 cursor-pointer hover:bg-gray-50 border-l-4 border-blue-400">
             <div className="flex justify-between items-start">
                <div>
                   <h3 className="font-bold text-lg">{acc.name}</h3>
                   <p className="text-sm text-gray-500">Total: R$ {acc.totalValue.toFixed(2)} ({acc.installmentsCount}x)</p>
                   {acc.description && <p className="text-xs text-gray-400">{acc.description}</p>}
                </div>
                <button onClick={(e) => handleDelete(acc.id, e)} className="text-red-400 p-1"><Trash2 size={18} /></button>
             </div>
             
             <div className="mt-3 space-y-2">
                {acc.installments.map(inst => (
                   <div key={inst.id} onClick={e => e.stopPropagation()} className="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                      <span className="w-8 text-gray-500">{inst.number}x</span>
                      <span className="flex-1 text-center">{parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}</span>
                      
                      <div className="w-24 text-right">
                         {inst.originalValue && inst.originalValue !== inst.value ? (
                           <div className="flex flex-col items-end">
                              <span className="line-through text-xs text-gray-400">R$ {inst.originalValue.toFixed(2)}</span>
                              <span>R$ {inst.value.toFixed(2)}</span>
                           </div>
                         ) : (
                           <span>R$ {inst.value.toFixed(2)}</span>
                         )}
                      </div>

                      <div className="w-28 flex justify-end">
                         {inst.status === 'paid' ? (
                            <div className="flex flex-col items-end">
                              <span className="text-green-600 font-bold text-xs flex items-center">
                                <Check size={12} className="mr-1"/> Pago
                              </span>
                              {inst.paidDate && <span className="text-[10px] text-gray-400">{parseLocalDate(inst.paidDate).toLocaleDateString('pt-BR')}</span>}
                            </div>
                         ) : (
                            <button 
                               onClick={() => initiatePayment(acc.id, inst.id, inst.value)}
                               className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded hover:bg-blue-200"
                            >
                               Pagar
                            </button>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ))}
        {filteredAccounts.length === 0 && <p className="text-center text-gray-400">Nenhuma conta encontrada.</p>}
      </div>

      <PaymentModal 
         isOpen={paymentModal.isOpen}
         onClose={() => setPaymentModal({isOpen: false, accountId: null, installmentId: null, total: 0})}
         onConfirm={confirmPayment}
         totalValue={paymentModal.total}
         title="Pagamento de Parcela"
      />
    </div>
  );
};

const CommunicationView = () => {
  const { data, addMessageTemplate, navigate, isLicenseValid } = useContext(AppContext);
  const [newTemplate, setNewTemplate] = useState<Partial<MessageTemplate>>({ type: 'general' });
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleAdd = () => {
    if (newTemplate.title && newTemplate.content) {
      addMessageTemplate({
        id: Date.now().toString(),
        title: newTemplate.title,
        type: newTemplate.type as any,
        content: newTemplate.content
      });
      setNewTemplate({ type: 'general', title: '', content: '' });
    }
  };

  const filteredTemplates = data.messageTemplates.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-20 md:pb-0">
      <h2 className="text-xl font-bold mb-4">Modelos de Mensagem</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-4 rounded shadow h-fit md:col-span-1 w-full min-w-0">
           <h3 className="font-bold mb-2">Novo Modelo</h3>
           <input 
             className="w-full p-2 border rounded mb-2"
             placeholder="Título do Modelo"
             value={newTemplate.title || ''}
             onChange={e => setNewTemplate({...newTemplate, title: e.target.value})}
           />
           <select 
              className="w-full p-2 border rounded mb-2"
              value={newTemplate.type}
              onChange={e => setNewTemplate({...newTemplate, type: e.target.value as any})}
           >
             <option value="general">Geral</option>
             <option value="renewal">Renovação</option>
             <option value="offer">Oferta</option>
             <option value="birthday">Aniversário (Geral)</option>
             <option value="overdue">Vencidos</option>
             <option value="due_soon">A Vencer</option>
             <option value="black_friday">Black Friday</option>
             <option value="gratitude">Agradecimentos</option>
             <option value="support_solved">Solução de Suporte</option>
             <option value="blocked">Bloqueios</option>
             <option value="contract_anniversary">Aniversário da Contratação</option>
             <option value="client_birthday">Aniversário do Cliente</option>
             <option value="plans">Planos</option>
           </select>
           <textarea 
             className="w-full p-2 border rounded mb-2 h-32"
             placeholder="Conteúdo da mensagem. Use {nome}, {data}, {valor} como variáveis."
             value={newTemplate.content || ''}
             onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
           />
           <div className="text-xs text-gray-500 mb-2">
             Variáveis disponíveis: {'{nome}'}, {'{data}'}, {'{valor}'}
           </div>
           <button 
             onClick={handleAdd}
             className="w-full bg-brand-blue text-white p-2 rounded"
           >
             Adicionar Modelo
           </button>
        </div>

        <div className="space-y-2 md:col-span-2">
          <SearchFilterBar 
             searchTerm={searchTerm} 
             setSearchTerm={setSearchTerm} 
             placeholder="Buscar modelo..." 
          />
          {filteredTemplates.map(t => (
            <div key={t.id} className="bg-white p-3 rounded shadow border-l-4 border-blue-500">
               <div className="flex justify-between">
                 <h4 className="font-bold">{t.title}</h4>
                 <span className="text-xs bg-gray-100 px-2 py-1 rounded">{t.type}</span>
               </div>
               <p className="text-sm text-gray-600 mt-1 truncate">{t.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { data, saveSettings, setData, isLicenseValid } = useContext(AppContext);
  const [localSettings, setLocalSettings] = useState<Settings>(data.settings);

  const handleSave = () => {
    saveSettings(localSettings);
    alert('Configurações salvas com sucesso!');
  };

  const handleImageUpload = (field: 'profileImage' | 'supportImage', file: File) => {
    if (!isLicenseValid && field === 'profileImage') {
       alert("Personalização de imagem disponível apenas na versão Premium.");
       return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setLocalSettings(prev => ({ ...prev, [field]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleBackup = () => {
     if (!isLicenseValid) {
        alert("Backup disponível apenas na versão Premium.");
        return;
     }
     const dataStr = JSON.stringify(data);
     const blob = new Blob([dataStr], {type: "application/json"});
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `backup_iptv_${new Date().toISOString().split('T')[0]}.json`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLicenseValid) {
       alert("Restauração disponível apenas na versão Premium.");
       return;
    }
    const file = e.target.files?.[0];
    if (file) {
       const reader = new FileReader();
       reader.onload = (e) => {
          try {
             const json = JSON.parse(e.target?.result as string);
             if (json.clients && json.plans) {
                setData(json);
                alert("Dados restaurados com sucesso!");
                setLocalSettings(json.settings);
             } else {
                alert("Arquivo de backup inválido.");
             }
          } catch (err) {
             alert("Erro ao ler arquivo.");
          }
       };
       reader.readAsText(file);
    }
  };

  return (
    <div className="pb-20 md:pb-0">
       <h2 className="text-xl font-bold mb-4">Configurações</h2>
       
       <div className="bg-white p-4 rounded shadow mb-6">
          <h3 className="font-bold mb-4 flex items-center"><SettingsIcon size={20} className="mr-2"/> Geral</h3>
          {!isLicenseValid && (
             <p className="text-sm text-orange-600 font-bold mb-2">Requer licença ativa</p>
          )}
          
          <div className={`grid md:grid-cols-2 gap-4 mb-4 ${!isLicenseValid ? 'opacity-50 pointer-events-none' : ''}`}>
             <div>
                <label className="block text-sm text-gray-600">Nome da Empresa</label>
                <input 
                   className="w-full p-2 border rounded"
                   value={localSettings.companyName}
                   onChange={e => setLocalSettings({...localSettings, companyName: e.target.value})}
                />
             </div>
             <div>
                <label className="block text-sm text-gray-600">Documento (CPF/CNPJ)</label>
                <input 
                   className="w-full p-2 border rounded"
                   value={localSettings.document}
                   onChange={e => setLocalSettings({...localSettings, document: e.target.value})}
                />
             </div>
          </div>

          {/* Pix Settings */}
          <div className={`mb-4 pt-4 border-t ${!isLicenseValid ? 'opacity-50 pointer-events-none' : ''}`}>
             <h4 className="font-semibold text-sm mb-2 text-green-700 flex items-center"><QrCode size={16} className="mr-1"/> Configuração Pix (Cobrança)</h4>
             <div className="grid md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm text-gray-600">Nome Completo (Titular Pix)</label>
                  <input 
                    className="w-full p-2 border rounded"
                    placeholder="Ex: João Silva"
                    value={localSettings.pixName || ''}
                    onChange={e => setLocalSettings({...localSettings, pixName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-sm text-gray-600">Tipo de Chave</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={localSettings.pixKeyType || 'email'}
                    onChange={e => setLocalSettings({...localSettings, pixKeyType: e.target.value as any})}
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Chave Aleatória</option>
                  </select>
               </div>
               <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600">Chave Pix</label>
                  <input 
                    className="w-full p-2 border rounded"
                    placeholder="Sua chave Pix aqui"
                    value={localSettings.pixKey || ''}
                    onChange={e => setLocalSettings({...localSettings, pixKey: e.target.value})}
                  />
               </div>
             </div>
          </div>
          
          <div className={`mb-4 pt-4 border-t ${!isLicenseValid ? 'opacity-50 pointer-events-none' : ''}`}>
             <label className="block text-sm text-gray-600">Logo da Empresa</label>
             <div className="flex items-center space-x-4 mt-2">
                <img src={localSettings.profileImage || SPLASH_IMAGE} className="w-16 h-16 rounded object-cover border" />
                <input 
                   type="file" 
                   accept="image/*"
                   onChange={(e) => e.target.files && handleImageUpload('profileImage', e.target.files[0])}
                   className="text-sm"
                />
             </div>
          </div>

          <div className="mb-4 pt-4 border-t">
             <h4 className="font-semibold text-sm mb-2">Preferências do Dashboard</h4>
             {!isLicenseValid && <p className="text-xs text-orange-600 mb-2">Disponível apenas com licença ativa</p>}
             <div className={`grid md:grid-cols-2 gap-4 ${!isLicenseValid ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <div className="flex flex-col">
                      <span className="text-sm">Alerta Clientes (Dashboard)</span>
                      <span className="text-xs text-gray-400">Mostrar card urgente (24h)</span>
                   </div>
                   <input 
                      type="checkbox" 
                      checked={localSettings.dashboardShowClientAlerts}
                      onChange={e => setLocalSettings({...localSettings, dashboardShowClientAlerts: e.target.checked})}
                   />
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <span className="text-sm">Contas a Pagar (Dashboard)</span>
                   <input 
                      type="checkbox" 
                      checked={localSettings.dashboardShowAccounts}
                      onChange={e => setLocalSettings({...localSettings, dashboardShowAccounts: e.target.checked})}
                   />
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <span className="text-sm">Dias Antecedência (Receber)</span>
                   <input 
                      type="number" 
                      className="w-16 p-1 border rounded text-center"
                      value={localSettings.dashboardAlertDays}
                      onChange={e => setLocalSettings({...localSettings, dashboardAlertDays: Number(e.target.value)})}
                   />
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <span className="text-sm">Aniversariantes (Dashboard)</span>
                   <input 
                      type="checkbox" 
                      checked={localSettings.dashboardShowBirthdays}
                      onChange={e => setLocalSettings({...localSettings, dashboardShowBirthdays: e.target.checked})}
                   />
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <span className="text-sm">Dias Antecedência (Aniver)</span>
                   <input 
                      type="number" 
                      className="w-16 p-1 border rounded text-center"
                      value={localSettings.dashboardBirthdayDays}
                      onChange={e => setLocalSettings({...localSettings, dashboardBirthdayDays: Number(e.target.value)})}
                   />
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                   <span className="text-sm">Acompanhamento Pagamento</span>
                   <input 
                      type="checkbox" 
                      checked={localSettings.dashboardShowPaymentMonitoring}
                      onChange={e => setLocalSettings({...localSettings, dashboardShowPaymentMonitoring: e.target.checked})}
                   />
                </div>
             </div>
          </div>
          
           {/* Support Section */}
           <div className="mb-4 pt-4 border-t" id="suporte">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                 <Briefcase size={16} /> Central de Atendimento
              </h4>
              <div className="flex items-center space-x-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                 <div className="w-20 h-20">
                     <img 
                       src={SUPPORT_IMAGE} 
                       className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm" 
                       alt="Suporte"
                     />
                 </div>
                 <div className="text-sm flex-1">
                    <p className="font-bold text-gray-800 mb-1">Contato Oficial</p>
                    <p className="mb-1 flex items-center">
                       <Phone size={14} className="mr-2 text-green-600"/>
                       <a href={`https://wa.me/${SUPPORT_PHONE}`} className="text-green-600 font-bold hover:underline">
                          {SUPPORT_PHONE}
                       </a>
                    </p>
                    <p className="flex items-center text-gray-600">
                       <MessageCircle size={14} className="mr-2"/>
                       {SUPPORT_EMAIL}
                    </p>
                 </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">ℹ️ Foto fixa - Imagem do suporte não pode ser alterada</p>
           </div>

          <button onClick={handleSave} className="bg-brand-blue text-white px-4 py-2 rounded mt-4">Salvar Alterações</button>
       </div>

       <div className="bg-white p-4 rounded shadow border-l-4 border-orange-500">
          <h3 className="font-bold mb-4 flex items-center"><Save size={20} className="mr-2"/> Backup e Restauração (Premium)</h3>
          {!isLicenseValid ? (
             <p className="text-sm text-gray-500">Requer licença ativa</p>
          ) : (
            <div className="flex space-x-4">
               <button onClick={handleBackup} className="flex-1 bg-gray-100 text-gray-700 p-4 rounded flex flex-col items-center justify-center hover:bg-gray-200">
                  <Download size={24} className="mb-2"/>
                  <span>Baixar Backup</span>
               </button>
               <label className="flex-1 bg-gray-100 text-gray-700 p-4 rounded flex flex-col items-center justify-center hover:bg-gray-200 cursor-pointer">
                  <Upload size={24} className="mb-2"/>
                  <span>Restaurar Backup</span>
                  <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
               </label>
            </div>
          )}
       </div>
    </div>
  );
};

const LicensePlansPage = () => {
   const openWhatsApp = (planName: string, price: string) => {
     const text = `Olá, tenho interesse em adquirir o *${planName}* por *${price}*. Como prossigo?`;
     window.open(`https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(text)}`, '_blank');
   };

   return (
     <div className="pb-20 md:pb-0">
       <h2 className="text-2xl font-bold mb-6 text-gray-800">Planos de Licença</h2>
       <div className="grid md:grid-cols-3 gap-8">
         {/* Mensal */}
         <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl shadow-xl hover:scale-105 transition-transform text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20"><Star size={64}/></div>
            <h3 className="text-2xl font-bold mb-2">Mensal</h3>
            <p className="text-blue-100 mb-6 text-sm">Ideal para testar</p>
            <div className="text-4xl font-extrabold mb-6">R$ 3,90<span className="text-lg font-normal">/mês</span></div>
            <ul className="text-sm space-y-3 mb-8">
              <li className="flex items-center"><Check size={18} className="mr-2"/> Todos os recursos liberados</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Suporte prioritário</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Atualizações incluídas</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Cancelamento a qualquer momento</li>
            </ul>
            <button 
              onClick={() => openWhatsApp('Plano Mensal', 'R$ 3,90')}
              className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-md transition"
            >
              Começar Agora
            </button>
         </div>

         {/* Anual */}
         <div className="bg-gradient-to-br from-green-500 to-green-700 p-6 rounded-2xl shadow-2xl transform scale-105 z-10 text-white relative border-4 border-white/20">
             <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg shadow">MELHOR ESCOLHA</div>
            <h3 className="text-2xl font-bold mb-2">Anual</h3>
            <p className="text-green-100 mb-6 text-sm">Economia inteligente</p>
            <div className="text-4xl font-extrabold mb-6">R$ 19,90<span className="text-lg font-normal">/ano</span></div>
            <ul className="text-sm space-y-3 mb-8">
              <li className="flex items-center"><Check size={18} className="mr-2"/> <span className="font-bold">Tudo do mensal</span></li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Backup Automático</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Suporte via WhatsApp</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Atualizações antecipadas</li>
            </ul>
            <button 
              onClick={() => openWhatsApp('Plano Anual', 'R$ 19,90')}
              className="w-full bg-white text-green-600 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-md transition"
            >
              Garantir Desconto
            </button>
         </div>

         {/* Vitalício */}
         <div className="bg-gradient-to-br from-purple-600 to-indigo-800 p-6 rounded-2xl shadow-xl hover:scale-105 transition-transform text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-20"><Crown size={64}/></div>
            <h3 className="text-2xl font-bold mb-2">Vitalício</h3>
            <p className="text-indigo-100 mb-6 text-sm">Pague uma única vez</p>
            <div className="text-4xl font-extrabold mb-6">R$ 49,90<span className="text-lg font-normal">/único</span></div>
            <ul className="text-sm space-y-3 mb-8">
              <li className="flex items-center"><Check size={18} className="mr-2"/> Acesso eterno ao sistema</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Sem mensalidades</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Suporte VIP</li>
              <li className="flex items-center"><Check size={18} className="mr-2"/> Todas atualizações futuras</li>
            </ul>
            <button 
              onClick={() => openWhatsApp('Plano Vitalício', 'R$ 49,90')}
              className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-md transition"
            >
              Comprar Vitalício
            </button>
         </div>
       </div>
     </div>
   );
};

const LicenseActivationPage = () => {
  const { data, activateLicense, isLicenseValid } = useContext(AppContext);
  const [key, setKey] = useState('');
  
  const handleActivate = () => {
     const result = activateLicense(key);
     if (result === 'success') {
        alert("Licença ativada com sucesso!");
        setKey('');
     } else if (result === 'duplicate') {
        alert("Esta chave já foi utilizada.");
     } else {
        alert("Chave inválida. Verifique a chave.");
     }
  };

  return (
    <div className="pb-20 md:pb-0">
       <h2 className="text-xl font-bold mb-4">Licença e Ativação</h2>
       
       <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded shadow text-center">
             <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown size={40} className="text-brand-blue" />
             </div>
             <h3 className="text-2xl font-bold mb-2">{isLicenseValid ? 'Premium Ativo' : 'Versão Gratuita'}</h3>
             <p className="text-gray-500 mb-6">
                {isLicenseValid 
                   ? `Sua licença é válida até ${new Date(data.license.expirationDate).toLocaleDateString('pt-BR')}`
                   : "Ative para desbloquear todos os recursos."}
             </p>
             
             {!isLicenseValid && (
                <div className="bg-gray-50 p-4 rounded text-left mb-4">
                   <p className="font-bold text-sm mb-2">Benefícios Premium:</p>
                   <ul className="text-sm space-y-1 text-gray-600">
                      <li className="flex items-center"><Check size={14} className="mr-2 text-green-500"/> Clientes Ilimitados</li>
                      <li className="flex items-center"><Check size={14} className="mr-2 text-green-500"/> Backup e Restauração</li>
                      <li className="flex items-center"><Check size={14} className="mr-2 text-green-500"/> Personalização da Marca</li>
                      <li className="flex items-center"><Check size={14} className="mr-2 text-green-500"/> Gestão Financeira Completa</li>
                   </ul>
                </div>
             )}
          </div>

          <div className="bg-white p-6 rounded shadow">
             <h3 className="font-bold mb-4">Ativar Licença</h3>
             <p className="text-sm text-gray-500 mb-4">Insira a chave do dia (30 dias), anual ou vitalícia.</p>
             
             <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Chave de Ativação</label>
                <div className="flex">
                   <div className="bg-gray-100 p-2 rounded-l border border-r-0 flex items-center justify-center">
                      <Key size={18} className="text-gray-500" />
                   </div>
                   <input 
                      className="flex-1 p-2 border rounded-r uppercase"
                      placeholder="Insira a chave aqui"
                      value={key}
                      onChange={e => setKey(e.target.value)}
                   />
                </div>
             </div>
             
             <button 
                onClick={handleActivate}
                className="w-full bg-green-600 text-white p-3 rounded font-bold shadow-lg hover:bg-green-700 transition"
             >
                Validar Chave
             </button>
             
             <div className="mt-6 p-4 bg-blue-50 rounded text-center">
                <p className="text-sm text-blue-800">Precisa de ajuda? Entre em contato com o suporte.</p>
                <div className="flex justify-center space-x-4 mt-2">
                   <a href={`https://wa.me/${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className="text-green-600 font-bold flex items-center">
                      <Phone size={16} className="mr-1"/> WhatsApp
                   </a>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const FinancialControl = () => {
   const { navigate } = useContext(AppContext);
   const [activeTab, setActiveTab] = useState<'expirations' | 'accounts'>('expirations');

   return (
      <div className="pb-20 md:pb-0">
         <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-800 font-medium">
               Aqui você gerencia os vencimentos das suas contas e o vencimento dos seus clientes
            </p>
         </div>

         <div className="flex space-x-2 mb-4 border-b">
            <button 
               onClick={() => setActiveTab('expirations')}
               className={`py-2 px-4 font-semibold ${activeTab === 'expirations' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-500 hover:text-gray-700'}`}
            >
               Vencimentos (Clientes)
            </button>
            <button 
               onClick={() => setActiveTab('accounts')}
               className={`py-2 px-4 font-semibold ${activeTab === 'accounts' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-500 hover:text-gray-700'}`}
            >
               Contas a Pagar
            </button>
         </div>

         {activeTab === 'expirations' ? <ClientExpirationsList /> : <AccountsPayableList />}
      </div>
   );
};


const Layout = () => {
  const { currentView, navigate, isLicenseValid, data } = useContext(AppContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [controlMenuOpen, setControlMenuOpen] = useState(true);

  const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
      { id: 'clients', label: 'Clientes', icon: Users },
      { id: 'plans', label: 'Planos', icon: FileText },
      { id: 'communication', label: 'Mensagens', icon: MessageCircle },
      { id: 'licensePlans', label: 'Planos da Licença', icon: Award },
      { id: 'settings', label: 'Configurações', icon: SettingsIcon },
      { id: 'activation', label: 'Ativar Licença', icon: Key },
  ];

  const renderContent = () => {
      switch(currentView) {
          case 'dashboard': return <Dashboard />;
          case 'clients': return <ClientList />;
          case 'plans': return <PlanList />;
          case 'expirations': return <FinancialControl />; // Reusing Wrapper
          case 'accounts': return <FinancialControl />; // Reusing Wrapper
          case 'communication': return <CommunicationView />;
          case 'settings': return <SettingsView />;
          case 'licensePlans': return <LicensePlansPage />;
          case 'activation': return <LicenseActivationPage />;
          default: return <Dashboard />;
      }
  };
  
  return (
      <div className="flex h-screen bg-gray-100">
           {/* Mobile Header */}
           <div className="md:hidden fixed top-0 w-full bg-brand-blue text-white p-4 flex justify-between items-center z-20 shadow-md" style={{backgroundColor: '#1e40af'}}>
              <span className="font-bold">{data.settings.companyName}</span>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  {mobileMenuOpen ? <X /> : <Menu />}
              </button>
           </div>

           {/* Sidebar */}
           <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30 w-64 bg-white shadow-lg flex flex-col`}>
              <div className="p-6 flex flex-col items-center border-b">
                  <div className="w-20 h-20 rounded-full overflow-hidden border mb-2">
                     <img src={data.settings.profileImage || SPLASH_IMAGE} className="w-full h-full object-cover" />
                  </div>
                  <h2 className="font-bold text-gray-800 text-center">{data.settings.companyName}</h2>
                  {!isLicenseValid && <span className="text-xs bg-red-100 text-red-600 px-2 rounded-full mt-1">Versão Gratuita</span>}
                  {isLicenseValid && <span className="text-xs bg-green-100 text-green-600 px-2 rounded-full mt-1">Premium Ativo</span>}
              </div>
              <nav className="flex-1 overflow-y-auto py-4">
                  {/* Dashboard & Clients */}
                  <button
                      onClick={() => { navigate('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'dashboard' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <BarChart2 size={20} className="mr-3" /> Dashboard
                  </button>
                   <button
                      onClick={() => { navigate('clients'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'clients' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <Users size={20} className="mr-3" /> Clientes
                  </button>

                  {/* Collapsible Control Menu */}
                  <div>
                     <button
                        onClick={() => setControlMenuOpen(!controlMenuOpen)}
                        className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                     >
                        <div className="flex items-center">
                           <Briefcase size={20} className="mr-3" /> Controle
                        </div>
                        {controlMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                     </button>
                     {controlMenuOpen && (
                        <div className="bg-gray-50">
                           <button
                              onClick={() => { navigate('expirations'); setMobileMenuOpen(false); }}
                              className={`w-full flex items-center pl-12 pr-6 py-2 text-sm font-medium ${currentView === 'expirations' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                              <CalendarIcon size={16} className="mr-3" /> Vencimentos
                           </button>
                           <button
                              onClick={() => { navigate('accounts'); setMobileMenuOpen(false); }}
                              className={`w-full flex items-center pl-12 pr-6 py-2 text-sm font-medium ${currentView === 'accounts' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                              <DollarSign size={16} className="mr-3" /> Contas a Pagar
                           </button>
                        </div>
                     )}
                  </div>

                  {/* Other Items */}
                  <button
                      onClick={() => { navigate('plans'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'plans' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <FileText size={20} className="mr-3" /> Planos
                  </button>
                  <button
                      onClick={() => { navigate('communication'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'communication' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <MessageCircle size={20} className="mr-3" /> Mensagens
                  </button>
                   <button
                      onClick={() => { navigate('licensePlans'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'licensePlans' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <Award size={20} className="mr-3" /> Planos da Licença
                  </button>
                  <button
                      onClick={() => { navigate('settings'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'settings' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <SettingsIcon size={20} className="mr-3" /> Configurações
                  </button>
                   <button
                      onClick={() => { navigate('activation'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-6 py-3 text-sm font-medium ${currentView === 'activation' ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                      <Key size={20} className="mr-3" /> Ativar Licença
                  </button>
              </nav>
              <div className="p-4 border-t text-xs text-gray-400 text-center">
                  v2.5.0
              </div>
           </div>
           
           {/* Content */}
           <div className="flex-1 overflow-auto p-4 md:p-8 pt-20 md:pt-8">
              {renderContent()}
           </div>
      </div>
  );
};

const AppInner = () => {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
      return <SplashScreen onFinish={() => setLoading(false)} />;
  }
  
  return <Layout />;
}

const App = () => {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
};

export default App;