export interface Contact {
  id: string;
  name: string;
  phone: string;
  lawyer_name?: string;
  process_number?: string;
  cpf?: string;
  valor_da_causa?: number;
  status: 'novo' | 'aguardando' | 'respondido' | 'encerrado';
  is_priority?: boolean;
  last_message_at?: string;
  last_message_preview?: string;
  dispatched_phone_number_id?: string;
  ai_enabled?: boolean;
  whatsapp_profile_name?: string | null;
  ai_stage?: string | null;
  bank_data?: {
    banco?: string;
    agencia?: string;
    conta?: string;
    tipo?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  contact_id: string;
  window_expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  contact_id: string;
  direction: 'incoming' | 'outgoing';
  message_type: 'text' | 'template' | 'document' | 'image' | 'audio';
  content?: string;
  template_name?: string;
  document_url?: string;
  document_name?: string;
  image_url?: string;
  whatsapp_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_code?: string | null;
  error_details?: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  language: string;
  created_at: string;
}

export interface WhatsAppConfig {
  id: string;
  access_token?: string;
  waba_id?: string;
  phone_number_id?: string;
  is_validated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiConfig {
  id: string;
  name: string;
  access_token: string;
  waba_id: string;
  phone_number_id: string;
  is_active: boolean;
  is_validated: boolean;
  status_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportLog {
  id: string;
  total_contacts: number;
  successful: number;
  failed: number;
  raw_data?: string;
  created_at: string;
}

export interface ParsedContact {
  name: string;
  phone: string;
  lawyer_name: string;
  process_number: string;
  cpf?: string;
  renda?: number;
}

export interface ParsedBlock {
  lawyer: string;
  process: string;
  clientName: string;
  phones: string[];
  cpf?: string;
  renda?: string;
  contra?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_blocked: boolean;
  can_use_shared_api: boolean;
  device_fingerprint?: string;
  last_device_info?: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
  authorized_fingerprint?: string | null;
  authorized_device_info?: {
    browser?: string;
    os?: string;
    device?: string;
  } | null;
  last_login_at?: string;
  messages_sent: number;
  templates_sent: number;
  failed_device_attempts?: number;
  temp_banned_until?: string;
  ban_reason?: string;
  last_failed_attempt_at?: string;
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface DeviceSession {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_info?: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface UserWhatsAppConfig {
  id: string;
  user_id: string;
  access_token?: string;
  waba_id?: string;
  phone_number_id?: string;
  is_validated: boolean;
  created_at: string;
  updated_at: string;
}
