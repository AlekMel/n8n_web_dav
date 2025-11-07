import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import * as path from 'path';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'stream';

/**
 * Опции для создания WebDAV клиента
 */
export interface WebDAVClientOptions {
    username?: string;
    password?: string;
    token?: string;
    headers?: Record<string, string>;
    maxBodyLength?: number;
    maxContentLength?: number;
    httpsAgent?: https.Agent;
}

/**
 * Информация о файле или папке
 */
export interface FileInfo {
    filename: string;
    basename: string;
    type: 'file' | 'directory';
    size: number;
    lastmod: string;
    mime?: string;
    etag?: string;
}

/**
 * Структура WebDAV XML ответа (PROPFIND)
 */
interface WebDAVResponse {
    href: string;
    propstat: {
        prop: {
            getcontentlength?: string;
            getlastmodified?: string;
            getcontenttype?: string;
            getetag?: string;
            resourcetype?: {
                collection?: any;
            };
            displayname?: string;
        };
        status: string;
    } | Array<{
        prop: any;
        status: string;
    }>;
}

/**
 * Класс для WebDAV ошибок с детальной информацией
 */
export class WebDAVError extends Error {
    statusCode?: number;
    statusText?: string;
    response?: any;

    constructor(message: string, statusCode?: number, statusText?: string, response?: any) {
        super(message);
        this.name = 'WebDAVError';
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.response = response;
    }
}

/**
 * Простая реализация WebDAV клиента с использованием Axios
 */
export class WebDAVClient {
    private axios: AxiosInstance;
    private baseURL: string;
    private xmlParser: XMLParser;

    constructor(baseURL: string, options: WebDAVClientOptions = {}) {
        this.baseURL = baseURL;
        
        // Инициализация XML парсера
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true,
            trimValues: true,
        });
        
        const axiosConfig: AxiosRequestConfig = {
            baseURL,
            maxBodyLength: options.maxBodyLength || 524288000, // 500MB (увеличено для больших файлов)
            maxContentLength: options.maxContentLength || 524288000, // 500MB
            httpsAgent: options.httpsAgent,
            headers: {
                'Content-Type': 'application/octet-stream',
                ...options.headers
            }
        };

        // Добавление аутентификации
        if (options.username && options.password) {
            axiosConfig.auth = {
                username: options.username,
                password: options.password
            };
        } else if (options.token) {
            axiosConfig.headers = {
                ...axiosConfig.headers,
                'Authorization': `Bearer ${options.token}`
            };
        }

        this.axios = axios.create(axiosConfig);
    }

    /**
     * Обработка ошибок Axios с детальной информацией
     */
    private handleError(error: any, context: string): never {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            const statusCode = axiosError.response?.status;
            const statusText = axiosError.response?.statusText;
            
            let message = `${context}: `;
            
            switch (statusCode) {
                case 401:
                    message += 'Ошибка аутентификации. Проверьте учетные данные.';
                    break;
                case 403:
                    message += 'Доступ запрещен. Недостаточно прав.';
                    break;
                case 404:
                    message += 'Ресурс не найден.';
                    break;
                case 405:
                    message += 'Метод не поддерживается сервером.';
                    break;
                case 409:
                    message += 'Конфликт. Ресурс уже существует или заблокирован.';
                    break;
                case 412:
                    message += 'Предусловие не выполнено.';
                    break;
                case 423:
                    message += 'Ресурс заблокирован.';
                    break;
                case 507:
                    message += 'Недостаточно места на сервере.';
                    break;
                default:
                    message += axiosError.message;
            }
            
            throw new WebDAVError(message, statusCode, statusText, axiosError.response?.data);
        }
        
        throw new WebDAVError(`${context}: ${error.message}`);
    }

    /**
     * Парсинг WebDAV XML ответа
     */
    private parseWebDAVResponse(xmlData: string): WebDAVResponse[] {
        try {
            const parsed = this.xmlParser.parse(xmlData);
            
            // WebDAV ответ имеет структуру: multistatus -> response[]
            const multistatus = parsed['d:multistatus'] || parsed['D:multistatus'] || parsed.multistatus;
            if (!multistatus) {
                throw new Error('Неверный формат WebDAV ответа');
            }
            
            let responses = multistatus['d:response'] || multistatus['D:response'] || multistatus.response;
            
            // Приведение к массиву
            if (!Array.isArray(responses)) {
                responses = [responses];
            }
            
            return responses.map((resp: any) => this.normalizeWebDAVResponse(resp));
        } catch (error: any) {
            throw new WebDAVError(`Ошибка парсинга XML: ${error.message}`);
        }
    }

    /**
     * Нормализация WebDAV ответа с учетом различных namespace префиксов
     */
    private normalizeWebDAVResponse(response: any): WebDAVResponse {
        const getField = (obj: any, ...keys: string[]): any => {
            for (const key of keys) {
                if (obj[key] !== undefined) return obj[key];
            }
            return undefined;
        };
        
        const href = getField(response, 'd:href', 'D:href', 'href');
        const propstat = getField(response, 'd:propstat', 'D:propstat', 'propstat');
        
        // Обработка propstat (может быть массивом)
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];
        const successPropstat = propstatArray.find((ps: any) => {
            const status = getField(ps, 'd:status', 'D:status', 'status');
            return status && status.includes('200');
        }) || propstatArray[0];
        
        const prop = getField(successPropstat, 'd:prop', 'D:prop', 'prop') || {};
        
        return {
            href: decodeURIComponent(href || ''),
            propstat: {
                prop: {
                    getcontentlength: getField(prop, 'd:getcontentlength', 'D:getcontentlength', 'getcontentlength'),
                    getlastmodified: getField(prop, 'd:getlastmodified', 'D:getlastmodified', 'getlastmodified'),
                    getcontenttype: getField(prop, 'd:getcontenttype', 'D:getcontenttype', 'getcontenttype'),
                    getetag: getField(prop, 'd:getetag', 'D:getetag', 'getetag'),
                    resourcetype: getField(prop, 'd:resourcetype', 'D:resourcetype', 'resourcetype'),
                    displayname: getField(prop, 'd:displayname', 'D:displayname', 'displayname'),
                },
                status: getField(successPropstat, 'd:status', 'D:status', 'status') || 'HTTP/1.1 200 OK',
            },
        };
    }

    /**
     * Преобразование WebDAV ответа в FileInfo
     */
    private webdavResponseToFileInfo(response: WebDAVResponse): FileInfo {
        const prop = Array.isArray(response.propstat) 
            ? response.propstat[0].prop 
            : response.propstat.prop;
        
        const isDirectory = prop.resourcetype && 
            (prop.resourcetype.collection !== undefined || 
             prop.resourcetype['d:collection'] !== undefined ||
             prop.resourcetype['D:collection'] !== undefined);
        
        return {
            filename: response.href,
            basename: path.basename(response.href) || prop.displayname || '',
            type: isDirectory ? 'directory' : 'file',
            size: parseInt(prop.getcontentlength || '0', 10),
            lastmod: prop.getlastmodified || new Date().toISOString(),
            mime: prop.getcontenttype,
            etag: prop.getetag,
        };
    }

    /**
     * Проверяет существование файла или папки
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            const response = await this.axios.head(filePath);
            return response.status >= 200 && response.status < 300;
        } catch (error: any) {
            // 404 означает, что ресурс не существует
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return false;
            }
            // Для других ошибок возвращаем false
            return false;
        }
    }

    /**
     * Получает содержимое файла
     */
    async getFileContents(filePath: string, options: { format?: string } = {}): Promise<Buffer | string> {
        try {
            const response = await this.axios.get(filePath, {
                responseType: options.format === 'binary' ? 'arraybuffer' : 'text'
            });
            
            if (options.format === 'binary') {
                return Buffer.from(response.data);
            }
            
            return response.data;
        } catch (error: any) {
            this.handleError(error, 'Не удалось получить содержимое файла');
        }
    }

    /**
     * Получает содержимое файла как поток (для больших файлов)
     */
    async getFileStream(filePath: string): Promise<Readable> {
        try {
            const response = await this.axios.get(filePath, {
                responseType: 'stream'
            });
            
            return response.data as Readable;
        } catch (error: any) {
            this.handleError(error, 'Не удалось получить поток файла');
        }
    }

    /**
     * Загружает содержимое файла
     */
    async putFileContents(filePath: string, data: Buffer | string, options: { overwrite?: boolean } = {}): Promise<void> {
        try {
            // Проверить, если файл существует и перезапись не разрешена
            if (!options.overwrite) {
                const exists = await this.exists(filePath);
                if (exists) {
                    throw new WebDAVError(`Файл ${filePath} уже существует`, 409, 'Conflict');
                }
            }

            await this.axios.put(filePath, data, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });
        } catch (error: any) {
            if (error instanceof WebDAVError) {
                throw error;
            }
            this.handleError(error, 'Не удалось загрузить содержимое файла');
        }
    }

    /**
     * Загружает файл из потока (для больших файлов)
     */
    async putFileStream(filePath: string, stream: Readable, options: { overwrite?: boolean } = {}): Promise<void> {
        try {
            // Проверить, если файл существует и перезапись не разрешена
            if (!options.overwrite) {
                const exists = await this.exists(filePath);
                if (exists) {
                    throw new WebDAVError(`Файл ${filePath} уже существует`, 409, 'Conflict');
                }
            }

            await this.axios.put(filePath, stream, {
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
        } catch (error: any) {
            if (error instanceof WebDAVError) {
                throw error;
            }
            this.handleError(error, 'Не удалось загрузить поток файла');
        }
    }

    /**
     * Создает директорию
     */
    async createDirectory(dirPath: string): Promise<void> {
        try {
            await this.axios.request({
                method: 'MKCOL',
                url: dirPath
            });
        } catch (error: any) {
            this.handleError(error, 'Не удалось создать директорию');
        }
    }

    /**
     * Удаляет файл или папку
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await this.axios.delete(filePath);
        } catch (error: any) {
            this.handleError(error, 'Не удалось удалить файл или папку');
        }
    }

    /**
     * Перемещает или переименовывает файл
     */
    async moveFile(source: string, destination: string, options: { overwrite?: boolean } = {}): Promise<void> {
        try {
            const headers: Record<string, string> = {
                'Destination': this.createAbsoluteUrl(destination)
            };
            
            // Добавляем заголовок Overwrite
            if (options.overwrite !== undefined) {
                headers['Overwrite'] = options.overwrite ? 'T' : 'F';
            }
            
            await this.axios.request({
                method: 'MOVE',
                url: source,
                headers
            });
        } catch (error: any) {
            this.handleError(error, 'Не удалось переместить файл');
        }
    }

    /**
     * Копирует файл
     */
    async copyFile(source: string, destination: string, options: { overwrite?: boolean } = {}): Promise<void> {
        try {
            const headers: Record<string, string> = {
                'Destination': this.createAbsoluteUrl(destination)
            };
            
            // Добавляем заголовок Overwrite
            if (options.overwrite !== undefined) {
                headers['Overwrite'] = options.overwrite ? 'T' : 'F';
            }
            
            await this.axios.request({
                method: 'COPY',
                url: source,
                headers
            });
        } catch (error: any) {
            this.handleError(error, 'Не удалось скопировать файл');
        }
    }

    /**
     * Получает информацию о файле или папке
     */
    async stat(filePath: string): Promise<FileInfo> {
        try {
            const response = await this.axios.request({
                method: 'PROPFIND',
                url: filePath,
                headers: {
                    'Depth': '0',
                    'Content-Type': 'application/xml; charset=utf-8'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?>
                      <d:propfind xmlns:d="DAV:">
                          <d:prop>
                              <d:resourcetype/>
                              <d:getcontentlength/>
                              <d:getlastmodified/>
                              <d:getcontenttype/>
                              <d:getetag/>
                              <d:displayname/>
                          </d:prop>
                      </d:propfind>`,
                responseType: 'text'
            });

            // Парсим XML ответ
            const webdavResponses = this.parseWebDAVResponse(response.data);
            
            if (webdavResponses.length === 0) {
                throw new WebDAVError('Не удалось получить информацию о ресурсе', 404, 'Not Found');
            }
            
            // Возвращаем информацию о первом (и единственном) ресурсе
            return this.webdavResponseToFileInfo(webdavResponses[0]);
        } catch (error: any) {
            if (error instanceof WebDAVError) {
                throw error;
            }
            this.handleError(error, 'Не удалось получить информацию о файле');
        }
    }

    /**
     * Получает содержимое директории
     */
    async getDirectoryContents(dirPath: string, options: { deep?: boolean } = {}): Promise<FileInfo[]> {
        try {
            // Нормализуем путь - убедимся, что он заканчивается на /
            let normalizedPath = dirPath;
            if (!normalizedPath.endsWith('/')) {
                normalizedPath += '/';
            }
            
            const response = await this.axios.request({
                method: 'PROPFIND',
                url: normalizedPath,
                headers: {
                    'Depth': options.deep ? 'infinity' : '1',
                    'Content-Type': 'application/xml; charset=utf-8'
                },
                data: `<?xml version="1.0" encoding="utf-8" ?>
                      <d:propfind xmlns:d="DAV:">
                          <d:prop>
                              <d:resourcetype/>
                              <d:getcontentlength/>
                              <d:getlastmodified/>
                              <d:getcontenttype/>
                              <d:getetag/>
                              <d:displayname/>
                          </d:prop>
                      </d:propfind>`,
                responseType: 'text'
            });

            // Парсим XML ответ
            const webdavResponses = this.parseWebDAVResponse(response.data);
            
            // Преобразуем в FileInfo и фильтруем саму директорию
            const files: FileInfo[] = [];
            
            for (const webdavResponse of webdavResponses) {
                // Пропускаем саму директорию
                const href = webdavResponse.href;
                
                // Различные способы определения, что это та же директория
                if (href === normalizedPath || 
                    href === dirPath ||
                    href === normalizedPath.slice(0, -1) ||
                    href + '/' === normalizedPath) {
                    continue;
                }
                
                const fileInfo = this.webdavResponseToFileInfo(webdavResponse);
                files.push(fileInfo);
            }
            
            return files;
        } catch (error: any) {
            if (error instanceof WebDAVError) {
                throw error;
            }
            this.handleError(error, 'Не удалось получить содержимое директории');
        }
    }

    /**
     * Вспомогательный метод для создания абсолютного URL
     */
    private createAbsoluteUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        
        try {
            return new URL(path, this.baseURL).toString();
        } catch (error) {
            // Если не удалось создать URL, возвращаем путь как есть
            return this.baseURL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        }
    }
}

/**
 * Функция для создания WebDAV клиента
 */
export function createClient(baseURL: string, options: WebDAVClientOptions = {}): WebDAVClient {
    return new WebDAVClient(baseURL, options);
} 