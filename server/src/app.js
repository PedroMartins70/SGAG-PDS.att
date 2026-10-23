import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

// Headers de segurança (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// Política estrita de CORS: apenas as origens do front-end
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origem nao permitida pela politica de CORS'));
      }
    },
  })
);

// Corpo JSON limitado (evita payloads abusivos)
app.use(express.json({ limit: '100kb' }));

// Proteção contra fingerprinting
app.disable('x-powered-by');

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
