import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import appConfig from './config/app.js';
import apiRoutes from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.js';

const app = express();
// Behind a reverse proxy / load balancer, req.ip must resolve to the real client
// IP (used by the anti-fraud MULTI_ACCOUNT_SAME_DEVICE signal), not the proxy IP.
// Controlled by TRUST_PROXY (default false = trust no proxy).
app.set('trust proxy', appConfig.trustProxy);
const corsOptions = appConfig.corsOrigins.includes('*')
  ? { origin: '*' }
  : appConfig.corsOrigins.length > 0
    ? { origin: appConfig.corsOrigins }
    : undefined;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1', apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;