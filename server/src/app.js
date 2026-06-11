import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import appConfig from './config/app.js';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: appConfig.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// TODO: Mount routes here
// import authRoutes from './routes/auth.routes.js';
// app.use('/api/auth', authRoutes);

export default app;
