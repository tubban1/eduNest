const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const isServerless = !!process.env.VERCEL;
const transports = [];

if (isServerless) {
	// Vercel 无服务器环境：只输出到控制台，避免写入只读文件系统
	transports.push(
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
				winston.format.simple()
			)
		})
	);
} else {
	// 本地/非无服务器：写入文件，先确保目录存在
	try {
		const logsDir = path.resolve(__dirname, '../../logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}
		transports.push(
			new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' })
		);
		transports.push(
			new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
		);
		// 开发环境同时输出控制台
		if (config.NODE_ENV !== 'production') {
			transports.push(
				new winston.transports.Console({
					format: winston.format.combine(
						winston.format.colorize(),
						winston.format.simple()
					)
				})
			);
		}
	} catch (e) {
		// 文件写入不可用时回退到控制台
		transports.push(
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
					winston.format.simple()
				)
			})
		);
	}
}

const logger = winston.createLogger({
	level: config.LOG_LEVEL || 'info',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.errors({ stack: true }),
		winston.format.json()
	),
	defaultMeta: { service: 'ai-education-backend' },
	transports
});

module.exports = logger; 