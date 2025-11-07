import {
  INodeTypeDescription,
  INodeProperties,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  ICredentialType,
  ICredentialsDecrypted,
  ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { WebDAVClient } from 'webdav';

// Расширенный интерфейс для WebDAV клиента
export interface IExtendedWebDAVClientOptions {
  username?: string;
  password?: string;
  token?: string;
  authType?: 'basic' | 'token';
  maxBodyLength?: number;
  maxContentLength?: number;
  httpsAgent?: any;
}

// Расширенный интерфейс для WebDAV учетных данных
export interface IWebDavCredentials extends ICredentialDataDecryptedObject {
  webdavUrl: string;
  username?: string;
  password?: string;
  token?: string;
  authType: 'basic' | 'token';
  allowUnauthorizedCerts?: boolean;
}

// Типы WebDAV серверов
export enum WebDavServerType {
  STANDARD = 'standard',
  YANDEX_DISK = 'yandexDisk',
  NEXTCLOUD = 'nextcloud',
  OWNCLOUD = 'owncloud',
  SHAREPOINT = 'sharepoint',
}

// Типы ресурсов
export enum ResourceType {
  FILE = 'file',
  FOLDER = 'folder',
}

// Операции для файлов
export enum FileOperation {
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  DELETE = 'delete',
  GET_INFO = 'getInfo',
  COPY = 'copy',
  MOVE = 'move',
}

// Операции для папок
export enum FolderOperation {
  LIST = 'list',
  CREATE = 'create',
  DELETE = 'delete',
}

// Источник данных для загрузки
export enum DataSource {
  BINARY = 'binary',
  TEXT = 'text',
} 