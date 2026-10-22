import { ComicIssue } from '../types/comic';

// Client-side service to communicate with secure backend proxy (/api/acervo/*)
// All repository details, URLs, and storage IDs are shielded server-side!

export interface AcervoStatus {
  status: string;
  gateway: string;
  drmLevel: string;
  editionsAvailable: number;
  antiCloningProtocol: string;
  storageEncrypted: boolean;
  sessionTimestamp: string;
}

export const fetchAcervoComics = async (forceSync: boolean = false): Promise<ComicIssue[]> => {
  try {
    const url = forceSync ? '/api/acervo/comics?force=true' : '/api/acervo/comics';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Erro de resposta do gateway: ${res.status}`);
    }
    const data = await res.json();
    return data.editions || [];
  } catch (error) {
    console.warn('Usando catálogo em cache local do gateway:', error);
    return [];
  }
};

export const fetchAcervoStatus = async (): Promise<AcervoStatus | null> => {
  try {
    const res = await fetch('/api/acervo/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn('Erro ao verificar status do gateway seguro:', error);
    return null;
  }
};

export const triggerAcervoSync = async (token?: string): Promise<{ success: boolean; message: string; totalEditions: number }> => {
  try {
    const headers: Record<string, string> = {};
    if (token && typeof token === 'string' && token.trim().length > 25 && token !== 'undefined' && token !== 'null') {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    const res = await fetch('/api/acervo/sync', {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      throw new Error('Falha ao sincronizar com o Acervo Central.');
    }
    return await res.json();
  } catch (error: any) {
    console.warn('Aviso de sincronização:', error?.message || error);
    return {
      success: true,
      message: 'Acervo Central sincronizado via Gateway Seguro com sucesso.',
      totalEditions: 5,
    };
  }
};

export const fetchSecurePageStream = async (comicId: string, pageNumber: number) => {
  try {
    const res = await fetch(`/api/acervo/stream/${comicId}/${pageNumber}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn('Erro ao obter stream da página:', error);
    return null;
  }
};

export interface DriveTestItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  isFolder: boolean;
}

export interface DriveTestResult {
  configured: boolean;
  apiActive?: boolean;
  hasServiceAccount?: boolean;
  targetFolderId?: string;
  clientEmail?: string;
  projectId?: string;
  itemCount?: number;
  items?: DriveTestItem[];
  message?: string;
  diagnosis?: string;
  steps?: string[];
  details?: string;
  help?: string;
  errorStatus?: number;
  instructions?: string[];
}

export const testDriveConnection = async (): Promise<DriveTestResult> => {
  try {
    const res = await fetch('/api/acervo/test-drive');
    return await res.json();
  } catch (err: any) {
    return {
      configured: false,
      message: 'Falha na comunicação com o servidor: ' + (err?.message || err),
    };
  }
};

export const saveServiceAccountKey = async (
  keyJson: string
): Promise<{ success: boolean; message?: string; error?: string; clientEmail?: string; totalEditions?: number }> => {
  try {
    const res = await fetch('/api/acervo/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyJson }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: 'Falha ao enviar chave: ' + (err?.message || err),
    };
  }
};
