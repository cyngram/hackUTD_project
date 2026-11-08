import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; 

const app = express();
app.use(express.json());    // Parse incoming JSON requests

//figure out the current file's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client', 'dist');

//----API routes here--------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Orbit' });
});

//serve React files
app.use(express.static(clientDir));

//other URLs get react
app.use((req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});