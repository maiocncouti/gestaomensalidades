
export interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  planId: string;
  dueDate: string; // YYYY-MM-DD (Plan Expiration)
  dueTime?: string; // HH:MM (Optional)
  paymentDate?: string; // YYYY-MM-DD (Date the payment is expected)
  birthDate: string; // YYYY-MM-DD
  paymentStatus: 'paid' | 'pending';
  profileImage?: string; // Base64 string for client photo
  notes?: string;
  createdAt?: string; // YYYY-MM-DD - Date of registration
  amountOwed?: number; // Specific amount owed (allows for 2x, 3x accumulation)
}

export interface AccountInstallment {
  id: string;
  number: number;
  value: number; // Remaining value to pay
  originalValue?: number; // Original value before partial payments
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  paidDate?: string; // YYYY-MM-DD
}

export interface AccountPayable {
  id: string;
  name: string;
  description?: string;
  totalValue: number;
  installmentsCount: number;
  installments: AccountInstallment[];
}

export interface Settings {
  companyName: string;
  ownerName: string;
  document: string; // CPF/CNPJ
  otherInfo: string;
  profileImage: string;
  supportImage: string; // Image for the support contact section
  dashboardAlertDays: number; // Configurable days for expiration alerts
  dashboardShowClientAlerts: boolean; // Toggle for client alerts on dashboard
  dashboardShowBirthdays: boolean; // Toggle for birthdays
  dashboardBirthdayDays: number; // Days to look ahead for birthdays
  dashboardShowAccounts: boolean; // Show accounts on dashboard
  dashboardAccountsDays: number; // Days to look ahead for accounts
  dashboardShowPaymentMonitoring: boolean; // Toggle for payment monitoring card
  
  // Pix Settings
  pixName: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pixKey: string;
}

export interface LicenseState {
  isActive: boolean;
  expirationDate: string; // ISO String
  usedKeys: { key: string; year: number }[]; // Track used keys to prevent reuse
}

export interface AppData {
  clients: Client[];
  plans: Plan[];
  accountsPayable: AccountPayable[];
  settings: Settings;
  license: LicenseState;
  messageTemplates: MessageTemplate[];
}

export interface MessageTemplate {
  id: string;
  title: string;
  type: 'renewal' | 'offer' | 'combo' | 'discount' | 'birthday' | 'general' | 'overdue' | 'due_soon' | 'black_friday' | 'gratitude' | 'support_solved' | 'blocked' | 'contract_anniversary' | 'client_birthday' | 'plans';
  content: string;
}

export type ViewState = 'dashboard' | 'clients' | 'plans' | 'expirations' | 'communication' | 'settings' | 'accounts' | 'licensePlans' | 'activation';
