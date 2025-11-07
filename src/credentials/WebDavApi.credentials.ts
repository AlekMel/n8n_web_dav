import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WebDavApi implements ICredentialType {
	name = 'webDavApi';
	displayName = 'WebDAV API';
	documentationUrl = '';
	properties: INodeProperties[] = [
		{
			displayName: 'WebDAV URL',
			name: 'webdavUrl',
			type: 'string',
			default: '',
			placeholder: 'https://webdav.example.com/remote.php/webdav/',
			required: true,
			description: 'URL вашего WebDAV сервера',
		},
		{
			displayName: 'Тип аутентификации',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'Basic Auth',
					value: 'basic',
				},
				{
					name: 'Token Auth',
					value: 'token',
				},
			],
			default: 'basic',
			description: 'Метод аутентификации для подключения к WebDAV серверу',
		},
		{
			displayName: 'Имя пользователя',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: [
						'basic',
					],
				},
			},
			description: 'Имя пользователя для Basic аутентификации',
		},
		{
			displayName: 'Пароль',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: [
						'basic',
					],
				},
			},
			description: 'Пароль для Basic аутентификации',
		},
		{
			displayName: 'Токен',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			displayOptions: {
				show: {
					authType: [
						'token',
					],
				},
			},
			description: 'Токен для аутентификации',
		},
		{
			displayName: 'Игнорировать проблемы SSL',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Игнорировать ошибки SSL, такие как самоподписанные или недействительные сертификаты',
		},
	];
} 