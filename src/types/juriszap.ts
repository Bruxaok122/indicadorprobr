export interface Contact {
  id: string;
  name: string;
  phone: string;
  lawyer_name?: string;
  process_number?: string;
  status: 'novo' | 'aguardando' | 'respondido' | 'encerrado';
  last_message_at?: string;
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
  message_type: 'text' | 'template' | 'document' | 'image';
  content?: string;
  template_name?: string;
  document_url?: string;
  document_name?: string;
  whatsapp_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
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
}

export interface ParsedBlock {
  lawyer: string;
  process: string;
  clientName: string;
  phones: string[];
}
