import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { npm } from 'winston/lib/winston/config';
import { ENV } from './env';

const { combine, timestamp, label, printf, json } = format;

const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${label} [${level}]: ${message}`;
});

const errorsFileTransport: DailyRotateFile = new DailyRotateFile({
  datePattern: 'DD-MM-YYYY',
  filename: 'logs/error-%DATE%.log',
  format: format.uncolorize(),
  handleExceptions: true,
  handleRejections: true,
  level: 'error',
  maxFiles: '14d',
});

const logsFileTransport: DailyRotateFile = new DailyRotateFile({
  datePattern: 'DD-MM-YYYY',
  filename: 'logs/application-%DATE%.log',
  format: format.uncolorize(),
  maxFiles: '14d',
});

const logger = createLogger({
  defaultMeta: { service: ENV.APP },
  format: combine(
    ENV.NODE_ENV !== 'production' ? format.colorize() : format.uncolorize(),
    label({ label: ENV.APP }),
    timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
    json(),
    customFormat,
  ),
  level: 'verbose',
  levels: npm.levels,
  transports: [
    errorsFileTransport,
    logsFileTransport,
    new transports.Console({ handleExceptions: true, handleRejections: true }),
  ],
});

export default logger;
