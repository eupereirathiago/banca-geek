#!/usr/bin/env node

/**
 * Script de teste isolado para conexão e listagem da pasta do Google Drive via Service Account
 * Pasta Alvo: 14R42LfMQvsU7SxkB5mNgPOTIh-i4u5Ch
 * Biblioteca: googleapis
 * Escopo: https://www.googleapis.com/auth/drive.readonly
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_FOLDER_ID = '109yWAVimD0IpUVUZsrRw5SGaciDlDIpK';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// Possíveis locais do arquivo de chave da Service Account
const CANDIDATE_KEY_PATHS = [
  process.argv[2],
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.resolve(__dirname, 'service-account.json'),
  path.resolve(__dirname, 'credentials.json'),
  path.resolve(__dirname, 'serviceAccountKey.json'),
  path.resolve(__dirname, 'key.json'),
  path.resolve(__dirname, 'google-credentials.json'),
].filter(Boolean);

function formatBytes(bytes) {
  if (!bytes) return 'N/A';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return 'N/A';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function findServiceAccountKey() {
  for (const candidate of CANDIDATE_KEY_PATHS) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.type === 'service_account' || parsed.client_email) {
          return { filePath: candidate, credentials: parsed };
        }
      }
    } catch {
      // Ignora arquivos que não sejam JSON válido
    }
  }

  // Verifica se a chave foi passada diretamente em variável de ambiente como string JSON
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      if (parsed.type === 'service_account' || parsed.client_email) {
        return { filePath: 'ENV:SERVICE_ACCOUNT_KEY', credentials: parsed };
      }
    } catch {}
  }

  return null;
}

async function runDriveTest() {
  console.log('='.repeat(70));
  console.log('   TESTE DE INTEGRAÇÃO COM GOOGLE DRIVE (SERVICE ACCOUNT)');
  console.log('='.repeat(70));
  console.log(`📂 Pasta Alvo ID: ${TARGET_FOLDER_ID}`);
  console.log(`🔒 Escopo Obrigatório: ${SCOPES[0]}`);
  console.log('');

  // 1. Localização e validação da Service Account Key
  const keyInfo = findServiceAccountKey();
  if (!keyInfo) {
    console.error('❌ ERRO: Nenhuma chave de Service Account (.json) foi encontrada!\n');
    console.log('📋 COMO CONFIGURAR PARA TESTAR:');
    console.log('1. Acesse o Google Cloud Console:');
    console.log('   https://console.cloud.google.com/iam-admin/serviceaccounts');
    console.log('2. Crie ou selecione uma Service Account (Conta de Serviço).');
    console.log('3. Na aba "Chaves" (Keys) -> "Adicionar Chave" -> "Criar nova chave" (JSON).');
    console.log('4. Baixe o arquivo e salve como "service-account.json" na raiz deste projeto:');
    console.log(`   ${path.resolve(__dirname, 'service-account.json')}`);
    console.log('   (ou execute: node test-drive.js /caminho/para/seu-arquivo-chave.json)');
    console.log('5. IMPORTANTE: Abra a pasta no Google Drive:');
    console.log(`   https://drive.google.com/drive/folders/${TARGET_FOLDER_ID}`);
    console.log('   Clique em "Compartilhar" e adicione o e-mail da Service Account (client_email)');
    console.log('   com a permissão de "Leitor" (Viewer) para que ela possa listar os arquivos.');
    console.log('='.repeat(70));
    process.exit(1);
  }

  const { filePath, credentials } = keyInfo;
  console.log(`🔑 Arquivo de chave: ${filePath}`);
  console.log(`📧 E-mail da Service Account: ${credentials.client_email}`);
  console.log(`🏢 Projeto Google Cloud: ${credentials.project_id || 'N/A'}`);
  console.log('');

  // 2. Inicialização da autenticação via GoogleAuth
  let auth;
  if (filePath.startsWith('ENV:')) {
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: filePath,
      scopes: SCOPES,
    });
  }

  const drive = google.drive({ version: 'v3', auth });

  // 3. Validação se a Google Drive API está ativa
  console.log('⏳ 1. Validando se a Google Drive API está ativa no projeto...');
  try {
    const aboutRes = await drive.about.get({
      fields: 'user, storageQuota',
    });
    console.log('✅ Google Drive API está ATIVA e respondendo com sucesso!');
    if (aboutRes.data.user?.emailAddress) {
      console.log(`   Identidade autenticada: ${aboutRes.data.user.emailAddress}`);
    }
  } catch (err) {
    const status = err.status || err.code;
    const msg = err.message || '';
    console.error(`\n❌ Falha na validação inicial da Google Drive API (Status: ${status}):`);
    console.error(`   ${msg}\n`);

    if (msg.includes('has not been used') || msg.includes('disabled') || status === 403) {
      console.log('💡 DIAGNÓSTICO: A Google Drive API pode não estar ativada no seu projeto Google Cloud.');
      console.log('👉 Para ativar, acesse o link direto:');
      console.log(`   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${credentials.project_id || ''}`);
      console.log('   Clique em "ATIVAR" e aguarde cerca de 1 minuto antes de testar novamente.');
    }
    console.log('='.repeat(70));
    process.exit(1);
  }

  // 4. Listar arquivos e subpastas dentro da pasta especificada
  console.log(`\n⏳ 2. Consultando itens dentro da pasta '${TARGET_FOLDER_ID}'...`);
  const query = `'${TARGET_FOLDER_ID}' in parents and trashed = false`;
  console.log(`🔍 Query: q = "${query}"`);
  console.log(`⚙️ Opções: supportsAllDrives = true, includeItemsFromAllDrives = true\n`);

  try {
    let allFiles = [];
    let pageToken = undefined;

    do {
      const res = await drive.files.list({
        q: query,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
        pageSize: 100,
        pageToken,
      });

      if (res.data.files && res.data.files.length > 0) {
        allFiles.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    console.log('='.repeat(70));
    console.log(`📊 RESULTADO DA BUSCA: ${allFiles.length} item(ns) encontrado(s)`);
    console.log('='.repeat(70));

    if (allFiles.length === 0) {
      console.log('ℹ️ A pasta está vazia ou os arquivos ainda não foram sincronizados dentro desta pasta.');
      console.log(`URL da pasta para conferir: https://drive.google.com/drive/folders/${TARGET_FOLDER_ID}`);
    } else {
      let folderCount = 0;
      let fileCount = 0;

      allFiles.forEach((file, index) => {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        if (isFolder) folderCount++;
        else fileCount++;

        const icon = isFolder ? '📁 [PASTA]  ' : '📄 [ARQUIVO]';
        const sizeInfo = isFolder ? '' : ` (${formatBytes(file.size)})`;
        console.log(`${(index + 1).toString().padStart(3, ' ')}. ${icon} ${file.name}${sizeInfo}`);
        console.log(`     ID:   ${file.id}`);
        console.log(`     Tipo: ${file.mimeType}`);
        console.log('');
      });

      console.log('='.repeat(70));
      console.log(`✅ SUCESSO! Total: ${allFiles.length} itens (${folderCount} subpasta(s), ${fileCount} arquivo(s)).`);
      console.log('='.repeat(70));
    }
  } catch (err) {
    const status = err.status || err.code;
    const msg = err.message || '';
    console.error(`\n❌ ERRO AO CONSULTAR A PASTA (Status: ${status}):`);
    console.error(`   ${msg}\n`);

    if (status === 403 || msg.includes('insufficientFilePermissions') || msg.includes('Forbidden')) {
      console.log('💡 DIAGNÓSTICO DO ERRO 403 (FALTA DE PERMISSÃO):');
      console.log('A Service Account NÃO tem permissão para ler esta pasta do Google Drive.');
      console.log('');
      console.log('👉 PASSO A PASSO PARA CORRIGIR:');
      console.log(`1. Abra a pasta no seu navegador: https://drive.google.com/drive/folders/${TARGET_FOLDER_ID}`);
      console.log('2. Clique no botão "Compartilhar" (Share) no canto superior direito.');
      console.log(`3. Cole o e-mail da sua Service Account:`);
      console.log(`   👉 ${credentials.client_email}`);
      console.log('4. Escolha o nível de permissão "Leitor" (Viewer).');
      console.log('5. Desmarque "Notificar pessoas" e clique em "Compartilhar" / "Salvar".');
      console.log('6. Execute este script novamente: node test-drive.js');
    } else if (status === 404 || msg.includes('File not found')) {
      console.log('💡 DIAGNÓSTICO DO ERRO 404 (NÃO ENCONTRADO):');
      console.log(`A pasta '${TARGET_FOLDER_ID}' não foi encontrada.`);
      console.log('Verifique se o ID está correto ou se a pasta foi movida para a lixeira.');
      console.log('Obs: No Google Drive, pastas não compartilhadas com a Service Account também podem retornar 404.');
    } else {
      console.log('💡 DICA DE ERRO:');
      console.log('Verifique sua conexão de rede e se as credenciais da Service Account são válidas.');
    }
    console.log('='.repeat(70));
    process.exit(1);
  }
}

runDriveTest();
