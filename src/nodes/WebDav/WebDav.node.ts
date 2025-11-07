import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
	IDataObject,
} from 'n8n-workflow';

// Импортируем нашу собственную реализацию WebDAV клиента
import { createClient, WebDAVError } from '../../webdav-client';

import * as https from 'https';
import * as path from 'path';

// Типы, перенесенные из n8n-types.d.ts
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

/**
 * WebDav нода для интеграции с WebDAV серверами, включая Яндекс.Диск.
 */
export class WebDav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WebDAV',
		name: 'webDav',
		icon: 'file:webdav.svg',
		group: ['input', 'output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Работа с файлами через WebDAV',
		defaults: {
			name: 'WebDAV',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'webDavApi',
				required: true,
			},
		],
		properties: [
			// Ресурсы (файл или папка)
			{
				displayName: 'Ресурс',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Файл',
						value: ResourceType.FILE,
					},
					{
						name: 'Папка',
						value: ResourceType.FOLDER,
					},
				],
				default: ResourceType.FILE,
				description: 'Тип ресурса для работы',
			},

			// Операции с файлами
			{
				displayName: 'Операция',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
					},
				},
				options: [
					{
						name: 'Скачать',
						value: FileOperation.DOWNLOAD,
						description: 'Скачать файл с WebDAV сервера',
						action: 'Скачать файл',
					},
					{
						name: 'Загрузить',
						value: FileOperation.UPLOAD,
						description: 'Загрузить файл на WebDAV сервер',
						action: 'Загрузить файл',
					},
					{
						name: 'Удалить',
						value: FileOperation.DELETE,
						description: 'Удалить файл с WebDAV сервера',
						action: 'Удалить файл',
					},
					{
						name: 'Получить информацию',
						value: FileOperation.GET_INFO,
						description: 'Получить информацию о файле',
						action: 'Получить информацию о файле',
					},
					{
						name: 'Копировать',
						value: FileOperation.COPY,
						description: 'Копировать файл на WebDAV сервере',
						action: 'Копировать файл',
					},
					{
						name: 'Переместить',
						value: FileOperation.MOVE,
						description: 'Переместить или переименовать файл',
						action: 'Переместить файл',
					},
				],
				default: FileOperation.DOWNLOAD,
			},

			// Операции с папками
			{
				displayName: 'Операция',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FOLDER,
						],
					},
				},
				options: [
					{
						name: 'Список',
						value: FolderOperation.LIST,
						description: 'Получить список содержимого папки',
						action: 'Получить список содержимого папки',
					},
					{
						name: 'Создать',
						value: FolderOperation.CREATE,
						description: 'Создать новую папку',
						action: 'Создать новую папку',
					},
					{
						name: 'Удалить',
						value: FolderOperation.DELETE,
						description: 'Удалить папку',
						action: 'Удалить папку',
					},
				],
				default: FolderOperation.LIST,
			},

			// Путь к файлу или папке
			{
				displayName: 'Путь',
				name: 'path',
				type: 'string',
				default: '',
				required: true,
				placeholder: '/path/to/file.txt',
				description: 'Путь к файлу или папке на WebDAV сервере',
			},

			// Параметры для загрузки файла
			{
				displayName: 'Источник данных',
				name: 'dataSource',
				type: 'options',
				options: [
					{
						name: 'Бинарные данные',
						value: DataSource.BINARY,
					},
					{
						name: 'Текст',
						value: DataSource.TEXT,
					},
				],
				default: DataSource.BINARY,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.UPLOAD,
						],
					},
				},
				description: 'Источник данных для загрузки',
			},

			// Имя бинарного свойства
			{
				displayName: 'Имя бинарного свойства',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.DOWNLOAD,
						],
					},
				},
				description: 'Имя бинарного свойства для сохранения данных',
			},
			{
				displayName: 'Имя бинарного свойства',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.UPLOAD,
						],
						dataSource: [
							DataSource.BINARY,
						],
					},
				},
				description: 'Имя бинарного свойства, из которого будут взяты данные для загрузки',
			},

			// Содержимое файла (для текстового ввода)
			{
				displayName: 'Содержимое файла',
				name: 'fileContent',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.UPLOAD,
						],
						dataSource: [
							DataSource.TEXT,
						],
					},
				},
				description: 'Текстовое содержимое файла для загрузки',
			},

			// Параметры для копирования и перемещения файлов
			{
				displayName: 'Целевой путь',
				name: 'targetPath',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.COPY,
							FileOperation.MOVE,
						],
					},
				},
				description: 'Целевой путь для копирования или перемещения',
			},

			// Параметры для списка файлов
			{
				displayName: 'Рекурсивно',
				name: 'recursive',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FOLDER,
						],
						operation: [
							FolderOperation.LIST,
						],
					},
				},
				description: 'Получить содержимое всех подпапок рекурсивно',
			},
			{
				displayName: 'Подробная информация',
				name: 'details',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FOLDER,
						],
						operation: [
							FolderOperation.LIST,
						],
					},
				},
				description: 'Включить подробную информацию о файлах и папках',
			},

			// Опция перезаписи файла
			{
				displayName: 'Перезаписать если существует',
				name: 'overwrite',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
						],
						operation: [
							FileOperation.UPLOAD,
							FileOperation.COPY,
							FileOperation.MOVE,
						],
					},
				},
				description: 'Перезаписать существующий файл',
			},

			// Опция создания родительских папок
			{
				displayName: 'Создавать родительские папки',
				name: 'createParentFolders',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: [
							ResourceType.FILE,
							ResourceType.FOLDER,
						],
						operation: [
							FileOperation.UPLOAD,
							FileOperation.COPY,
							FileOperation.MOVE,
							FolderOperation.CREATE,
						],
					},
				},
				description: 'Автоматически создавать родительские папки, если они не существуют',
			},

			// Тип WebDAV сервера
			{
				displayName: 'Тип WebDAV сервера',
				name: 'serverType',
				type: 'options',
				options: [
					{
						name: 'Стандартный WebDAV',
						value: WebDavServerType.STANDARD,
					},
					{
						name: 'Яндекс.Диск',
						value: WebDavServerType.YANDEX_DISK,
					},
					{
						name: 'Nextcloud',
						value: WebDavServerType.NEXTCLOUD,
					},
					{
						name: 'ownCloud',
						value: WebDavServerType.OWNCLOUD,
					},
					{
						name: 'Microsoft SharePoint',
						value: WebDavServerType.SHAREPOINT,
					},
				],
				default: WebDavServerType.STANDARD,
				description: 'Тип WebDAV сервера для специфических настроек',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const items = this.getInputData();
		let responseData: INodeExecutionData[] | IDataObject | undefined;

		// Получение учетных данных
		const credentials = await this.getCredentials('webDavApi');
		
		// Проверка URL
		if (!credentials.webdavUrl) {
			throw new NodeOperationError(this.getNode(), 'WebDAV URL не указан в учетных данных');
		}

		// Инициализация для каждого элемента
		for (let i = 0; i < items.length; i++) {
			try {
				// Получение параметров операции
				const resource = this.getNodeParameter('resource', i) as ResourceType;
				const operation = this.getNodeParameter('operation', i) as string;
				const filePath = this.getNodeParameter('path', i) as string;
				const serverType = this.getNodeParameter('serverType', i, WebDavServerType.STANDARD) as WebDavServerType;

				// Создание клиента WebDAV
				const options: any = {
					maxBodyLength: 1024 * 1024 * 100, // 100 MB
					maxContentLength: 1024 * 1024 * 100, // 100 MB
				};

				// Добавление аутентификации
				if (credentials.authType === 'basic') {
					options.username = credentials.username;
					options.password = credentials.password;
				} else if (credentials.authType === 'token') {
					options.headers = {
						Authorization: `Bearer ${credentials.token}`,
					};
				}

				// Настройка игнорирования SSL проблем
				if (credentials.allowUnauthorizedCerts === true) {
					options.httpsAgent = new https.Agent({
						rejectUnauthorized: false,
					});
				}

				// Специфические настройки для различных серверов
				if (serverType === WebDavServerType.YANDEX_DISK) {
					if (!options.headers) options.headers = {};
					options.headers['X-Yandex-SDK-Version'] = 'n8n-webdav-node';
				}

				// Нормализация URL
				let webdavUrl = credentials.webdavUrl as string;
				if (!webdavUrl.endsWith('/')) {
					webdavUrl = `${webdavUrl}/`;
				}

				// Яндекс.Диск специфический URL
				if (serverType === WebDavServerType.YANDEX_DISK && !webdavUrl.includes('webdav.yandex.ru')) {
					webdavUrl = 'https://webdav.yandex.ru/';
				}

				// Создание WebDAV клиента - теперь используем нашу реализацию
				const client = createClient(webdavUrl, options);

				// Вспомогательная функция для создания родительских папок
				const createParentDirectories = async (dirPath: string): Promise<void> => {
					// Разбиваем путь на части
					const parts = dirPath.split('/').filter(part => part.length > 0);
					let currentPath = '';
					
					// Последовательно создаем каждую папку в пути
					for (const part of parts) {
						currentPath += '/' + part;
						
						// Проверяем, существует ли папка
						const exists = await client.exists(currentPath);
						if (!exists) {
							// Создаем папку, если не существует
							await client.createDirectory(currentPath);
						}
					}
				};

				// Обработка операций в зависимости от типа ресурса и операции
				if (resource === ResourceType.FILE) {
					if (operation === FileOperation.DOWNLOAD) {
						// Скачивание файла
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						
						// Проверка существования файла
						const exists = await client.exists(filePath);
						if (!exists) {
							throw new NodeOperationError(this.getNode(), `Файл ${filePath} не существует на сервере`);
						}
						
						// Скачивание содержимого файла
						const fileContent = await client.getFileContents(filePath, { format: 'binary' }) as Buffer;
						
						// Получение информации о файле
						const fileInfo = await client.stat(filePath);
						const fileName = path.basename(filePath);
						
						// Преобразование в бинарные данные
						const mimeType = (fileInfo as any).mime || 'application/octet-stream';
						const binaryData = await this.helpers.prepareBinaryData(fileContent, fileName, mimeType);
						
						// Возврат результата
						const newItem: INodeExecutionData = {
							json: {
								success: true,
								file: filePath,
								name: fileName,
								size: (fileInfo as any).size,
								lastModified: (fileInfo as any).lastmod,
								operation: 'download',
							},
							binary: {},
						};
						
						newItem.binary![binaryPropertyName] = binaryData;
						responseData = newItem;
					}
					else if (operation === FileOperation.UPLOAD) {
						// Загрузка файла
						const dataSource = this.getNodeParameter('dataSource', i) as DataSource;
						const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
						const createParentFolders = this.getNodeParameter('createParentFolders', i, true) as boolean;
						
						let fileContent: Buffer | string;
						let fileName: string;
						
						// Получение содержимого файла в зависимости от источника данных
						if (dataSource === DataSource.BINARY) {
							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
							const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
							fileContent = Buffer.from(binaryData.data, 'base64');
							fileName = binaryData.fileName || path.basename(filePath);
						} else {
							fileContent = this.getNodeParameter('fileContent', i) as string;
							fileName = path.basename(filePath);
						}
						
						// Создание родительских папок при необходимости
						if (createParentFolders) {
							const dirPath = path.dirname(filePath);
							if (dirPath !== '/' && dirPath !== '.') {
								await createParentDirectories(dirPath);
							}
						}
						
						// Проверка существования файла
						if (!overwrite) {
							const exists = await client.exists(filePath);
							if (exists) {
								throw new NodeOperationError(this.getNode(), `Файл ${filePath} уже существует. Установите флаг "Перезаписать" для перезаписи.`);
							}
						}
						
						// Загрузка файла
						await client.putFileContents(filePath, fileContent, { overwrite });
						
						// Получение информации о загруженном файле
						const fileInfo = await client.stat(filePath);
						
						responseData = {
							success: true,
							file: filePath,
							name: fileName,
							size: (fileInfo as any).size,
							lastModified: (fileInfo as any).lastmod,
							operation: 'upload',
						};
					}
					else if (operation === FileOperation.DELETE) {
						// Удаление файла
						const exists = await client.exists(filePath);
						if (!exists) {
							throw new NodeOperationError(this.getNode(), `Файл ${filePath} не существует на сервере`);
						}
						
						await client.deleteFile(filePath);
						
						responseData = {
							success: true,
							file: filePath,
							operation: 'delete',
						};
					}
					else if (operation === FileOperation.GET_INFO) {
						// Получение информации о файле
						const exists = await client.exists(filePath);
						if (!exists) {
							throw new NodeOperationError(this.getNode(), `Файл ${filePath} не существует на сервере`);
						}
						
						const fileInfo = await client.stat(filePath);
						
						responseData = {
							success: true,
							file: filePath,
							name: path.basename(filePath),
							type: (fileInfo as any).type,
							size: (fileInfo as any).size,
							lastModified: (fileInfo as any).lastmod,
							mime: (fileInfo as any).mime,
							operation: 'getInfo',
						};
					}
					else if (operation === FileOperation.COPY) {
						// Копирование файла
						const targetPath = this.getNodeParameter('targetPath', i) as string;
						const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
						const createParentFolders = this.getNodeParameter('createParentFolders', i, true) as boolean;
						
						// Проверка существования исходного файла
						const sourceExists = await client.exists(filePath);
						if (!sourceExists) {
							throw new NodeOperationError(this.getNode(), `Исходный файл ${filePath} не существует на сервере`);
						}
						
						// Проверка существования целевого файла
						const targetExists = await client.exists(targetPath);
						if (targetExists && !overwrite) {
							throw new NodeOperationError(this.getNode(), `Целевой файл ${targetPath} уже существует. Установите флаг "Перезаписать" для перезаписи.`);
						}
						
						// Создание родительских папок при необходимости
						if (createParentFolders) {
							const dirPath = path.dirname(targetPath);
							if (dirPath !== '/' && dirPath !== '.') {
								await createParentDirectories(dirPath);
							}
						}
						
						// Копирование файла
						await client.copyFile(filePath, targetPath, { overwrite });
						
						// Получение информации о новом файле
						const fileInfo = await client.stat(targetPath);
						
						responseData = {
							success: true,
							sourceFile: filePath,
							targetFile: targetPath,
							name: path.basename(targetPath),
							size: (fileInfo as any).size,
							lastModified: (fileInfo as any).lastmod,
							operation: 'copy',
						};
					}
					else if (operation === FileOperation.MOVE) {
						// Перемещение/переименование файла
						const targetPath = this.getNodeParameter('targetPath', i) as string;
						const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
						const createParentFolders = this.getNodeParameter('createParentFolders', i, true) as boolean;
						
						// Проверка существования исходного файла
						const sourceExists = await client.exists(filePath);
						if (!sourceExists) {
							throw new NodeOperationError(this.getNode(), `Исходный файл ${filePath} не существует на сервере`);
						}
						
						// Проверка существования целевого файла
						const targetExists = await client.exists(targetPath);
						if (targetExists && !overwrite) {
							throw new NodeOperationError(this.getNode(), `Целевой файл ${targetPath} уже существует. Установите флаг "Перезаписать" для перезаписи.`);
						}
						
						// Создание родительских папок при необходимости
						if (createParentFolders) {
							const dirPath = path.dirname(targetPath);
							if (dirPath !== '/' && dirPath !== '.') {
								await createParentDirectories(dirPath);
							}
						}
						
						// Перемещение файла
						await client.moveFile(filePath, targetPath, { overwrite });
						
						// Получение информации о новом файле
						let fileInfo;
						try {
							fileInfo = await client.stat(targetPath);
						} catch (error) {
							// Если не удалось получить информацию, возвращаем базовую информацию
							fileInfo = {
								size: 0,
								lastmod: new Date().toISOString(),
							};
						}
						
						responseData = {
							success: true,
							sourceFile: filePath,
							targetFile: targetPath,
							name: path.basename(targetPath),
							size: (fileInfo as any).size,
							lastModified: (fileInfo as any).lastmod,
							operation: 'move',
						};
					}
				}
				else if (resource === ResourceType.FOLDER) {
					if (operation === FolderOperation.LIST) {
						// Получение списка содержимого папки
						const recursive = this.getNodeParameter('recursive', i, false) as boolean;
						const details = this.getNodeParameter('details', i, true) as boolean;
						
						// Проверка существования папки
						const exists = await client.exists(filePath);
						if (!exists) {
							throw new NodeOperationError(this.getNode(), `Папка ${filePath} не существует на сервере`);
						}
						
						// Получение содержимого папки
						const contents = await client.getDirectoryContents(filePath, { deep: recursive });
						
						// Формирование результата
						const returnItems: INodeExecutionData[] = [];
						
						for (const item of contents as any[]) {
							// Пропускаем текущую папку из результатов
							if (item.filename === filePath) continue;
							
							if (details) {
								// Подробный вывод
								returnItems.push({
									json: {
										path: item.filename,
										name: path.basename(item.filename),
										type: item.type,
										size: item.size,
										lastModified: item.lastmod,
										mime: item.mime,
									},
								});
							} else {
								// Упрощенный вывод
								returnItems.push({
									json: {
										path: item.filename,
										name: path.basename(item.filename),
										type: item.type,
									},
								});
							}
						}
						
						responseData = returnItems;
					}
					else if (operation === FolderOperation.CREATE) {
						// Создание папки
						const createParentFolders = this.getNodeParameter('createParentFolders', i, true) as boolean;
						
						// Проверка существования папки
						const exists = await client.exists(filePath);
						if (exists) {
							// Папка уже существует, возвращаем информацию
							responseData = {
								success: true,
								folder: filePath,
								name: path.basename(filePath),
								alreadyExists: true,
								operation: 'create',
							};
						} else {
							// Создание родительских папок при необходимости
							if (createParentFolders) {
								await createParentDirectories(filePath);
							} else {
								// Создание только указанной папки
								await client.createDirectory(filePath);
							}
							
							responseData = {
								success: true,
								folder: filePath,
								name: path.basename(filePath),
								alreadyExists: false,
								operation: 'create',
							};
						}
					}
					else if (operation === FolderOperation.DELETE) {
						// Удаление папки
						const exists = await client.exists(filePath);
						if (!exists) {
							throw new NodeOperationError(this.getNode(), `Папка ${filePath} не существует на сервере`);
						}
						
						await client.deleteFile(filePath);
						
						responseData = {
							success: true,
							folder: filePath,
							operation: 'delete',
						};
					}
				}

				// Добавление результата в возвращаемые данные
				if (Array.isArray(responseData)) {
					returnData.push.apply(returnData, responseData);
				} else if (responseData !== undefined) {
					// Если responseData уже является INodeExecutionData (имеет binary данные), добавляем напрямую
					if ((responseData as any).binary !== undefined) {
						returnData.push(responseData as INodeExecutionData);
					} else {
						// Иначе оборачиваем в json
						returnData.push({json: responseData as IDataObject});
					}
				}
			} catch (error: any) {
				// Улучшенная обработка ошибок с детальной информацией
				let errorMessage = error.message || 'Неизвестная ошибка';
				let errorDetails: IDataObject = {
					error: errorMessage
				};
				
				// Добавляем детальную информацию для WebDAV ошибок
				if (error instanceof WebDAVError) {
					errorDetails = {
						error: errorMessage,
						statusCode: error.statusCode,
						statusText: error.statusText,
						type: 'WebDAVError'
					};
				}
				
				if (this.continueOnFail()) {
					returnData.push({json: errorDetails});
					continue;
				}
				
				// Создаем NodeOperationError с детальной информацией
				throw new NodeOperationError(
					this.getNode(), 
					errorMessage,
					{
						itemIndex: i,
						description: error instanceof WebDAVError 
							? `HTTP ${error.statusCode}: ${error.statusText}` 
							: undefined
					}
				);
			}
		}

		return [returnData];
	}
} 