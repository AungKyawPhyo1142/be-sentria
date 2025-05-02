import logger from '@/logger';
import morgan from 'morgan';

const networkLog = morgan(
  function (tokens, req, res) {
    return JSON.stringify({
      content_length: tokens.res(req, res, 'content-length'),
      method: tokens.method(req, res),
      response_time: Number.parseFloat(
        tokens['response-time'](req, res) as string,
      ),
      status: Number.parseFloat(tokens.status(req, res) as string),
      url: tokens.url(req, res),
    });
  },
  {
    stream: {
      write: (message) => {
        logger.http(message);
      },
    },
  },
);

export default networkLog;
