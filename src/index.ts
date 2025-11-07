import { WebDavApi } from './credentials/WebDavApi.credentials';
import { WebDav } from './nodes/WebDav/WebDav.node';
import { join } from 'path';

// Экспорт типов учетных данных
export const credentials = {
	webDavApi: {
		className: WebDavApi,
		sourcePath: join(__dirname, 'credentials/WebDavApi.credentials.js'),
	},
};

// Экспорт типов нод
export const nodes = {
	webDav: {
		className: WebDav,
		sourcePath: join(__dirname, 'nodes/WebDav/WebDav.node.js'),
	},
}; 