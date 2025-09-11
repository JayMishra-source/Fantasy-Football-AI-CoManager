import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import espnRoutes from './routes/espn';
import testRoutes from './routes/test';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-ESPN-S2', 'X-ESPN-SWID'],
  exposedHeaders: ['X-ESPN-S2', 'X-ESPN-SWID']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/espn', espnRoutes);
app.use('/api/test', testRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});