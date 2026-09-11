# 🎬 MILO

A personal movie tracking dashboard with a futuristic dark theme, built with React, Node.js, and SQLite.

## ✨ Features

- **Add & Manage Movies & TV**: Track movies and TV series you've watched with ratings (1-10), genres, and notes
- **AI-Powered Recommendations**: Get personalized movie and TV suggestions using Ollama (optional) with two modes:
  - **Similar**: Content matching your taste based on viewing history
  - **Hidden Gems**: Lesser-known but highly-rated content perfect for you
- **Watch History Timeline**: Visual timeline of when you watched movies and TV shows
- **Advanced Search & Filter**: Search by title, filter by genre and rating
- **Analytics Dashboard**: View statistics like total movies/TV, average rating, and top genres
- **Futuristic UI**: Dark theme with neon accents, glassmorphism, and smooth animations

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- npm (comes with Node.js)

### Running MILO (Recommended - One Command!)

The start scripts handle everything automatically - including first-time setup:

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```batch
start.bat
```

That's it! The scripts will:
- ✅ Check if Node.js/npm is installed
- ✅ Auto-install dependencies if needed (first run only)
- ✅ Start both backend and frontend servers
- ✅ Display access URLs

**Press `Ctrl+C` to stop both servers**

### Optional: AI/Ollama Setup (for smart recommendations)

AI recommendations use Ollama, a local LLM service. To enable:

- **Install Ollama**: https://ollama.com/download
- **Pull a model**: `ollama pull qwen2.5:2b` (or any model from the dropdown)
- **Start Ollama service**: `ollama serve`

The app gracefully degrades to simple recommendations if Ollama is unavailable.

### Optional: Environment Configuration

Copy `backend/.env.example` to `backend/.env` and customize. Key variables:
- `OLLAMA_URL`: Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Default AI model for recommendations
- `OLLAMA_TIMEOUT_MS`: AI generation timeout in ms (default: 480000 / 8 min)
- `OLLAMA_MODELS_TIMEOUT_MS`: Model list timeout (default: 30000 / 30 sec)
- `OLLAMA_STATUS_TIMEOUT_MS`: Status check timeout (default: 15000 / 15 sec)
- `PORT`: Backend HTTP port (default: 3000)

All values have defaults - set only to override.

#### Option 2: Run in separate terminals

**Terminal 1 - Backend**:
```bash
cd backend
node server.js
```

The backend will start on `http://localhost:3000`

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

### Access the Dashboard

Open your browser and navigate to:
```
http://localhost:5173
```

## 📱 Access from Other Devices on WiFi

To access the dashboard from other devices on your local network:

### 1. Find your computer's IP address

**Linux/macOS:**
```bash
ip addr show | grep inet
```

**Windows:**
```batch
ipconfig
```

Look for an IP address like `192.168.x.x` or `10.0.x.x`

### 2. Allow the ports through your firewall

**Linux/macOS:**
```bash
sudo ufw allow 3000/tcp  # Backend port
sudo ufw allow 5173/tcp  # Frontend port
```

**Windows:**
```batch
netsh advfirewall firewall add rule name="MILO Backend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="MILO Frontend" dir=in action=allow protocol=TCP localport=5173
```

### 3. Configure network access (optional)

The Vite dev server automatically proxies `/api` requests to the backend at `http://localhost:3000`. No environment configuration is needed for local development.

If you need to connect to a backend on a different network, see `.env.example` for optional configuration options.

### 4. Access from other devices

From any device on your WiFi network:
- **Frontend**: `http://<YOUR_IP>:5173`
- **Backend API**: `http://<YOUR_IP>:3000`

For example, if your IP is `192.168.1.100`:
- Frontend: `http://192.168.1.100:5173`
- Backend: `http://192.168.1.100:3000`

## 🛠️ Project Structure

```
MILO/
├── backend/              # Node.js + Express server
│   ├── database.js      # SQLite database setup with auto-migration
│   ├── server.js        # Main server file
│   ├── ollama-recommender.js  # AI recommendation engine
│   ├── routes/          # API routes
│   │   └── index.js     # All API endpoints
│   ├── .env.example     # Environment variable template
│   └── package.json
├── frontend/            # React + Vite app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── api/         # API client
│   │   ├── utils/       # Context and utilities
│   │   ├── App.jsx      # Main app component
│   │   └── index.css    # Styles
│   └── package.json
├── movies.db           # SQLite database (auto-created)
└── README.md
```

## 🎨 Features Overview

### Movies Tab
- View all your movies in a grid layout
- Search by title or notes
- Filter by genre and rating
- Add, edit, and delete movies

### TV Series Tab
- View all your TV series in a grid layout
- Track number of seasons and episodes
- Search, filter, and manage TV shows
- Add, edit, and delete TV series

### Timeline Tab
- Visual timeline of your watch history
- Grouped by date
- Animated timeline nodes

### Recommendations Tab
- **Two AI recommendation types** (if Ollama is configured):
  - **Similar**: Content matching your taste based on viewing history, directors, genres
  - **Hidden Gems**: Lesser-known but highly-rated content perfect for you
- **Fallback recommendations**: Simple genre-based suggestions if AI unavailable
- **24-hour caching**: AI recommendations cached per content type and recommendation type
- **Model selection**: Choose from installed Ollama models or use default
- Genre distribution chart

## 🗄️ Database

The app uses SQLite for data storage. The database file (`movies.db`) is automatically created in the project root when you first run the backend.

**Movies & TV Table Schema**:
- `id`: Unique identifier
- `title`: Movie or TV series title
- `rating`: Rating from 1-10
- `genre`: Genre
- `date_watched`: Date you watched it
- `notes`: Personal notes/thoughts
- `director`: Director (for movies) or creator (optional)
- `type`: Content type (`movie` or `tv`)
- `num_seasons`: Number of seasons (TV only)
- `total_episodes`: Total episodes (TV only)
- `created_at`: Timestamp when added

## 🔧 Tech Stack

**Backend**:
- Node.js + Express
- SQLite3
- CORS
- Body-parser
- Ollama (optional, for AI recommendations)

**Frontend**:
- React 18
- Vite
- Tailwind CSS
- Framer Motion (animations)
- Lucide React (icons)

**AI/ML**:
- Ollama (local LLM runtime)
- Caching for AI responses (24h TTL)

## 📝 API Endpoints

### Movies
- `GET /api/movies` - Get all movies (with optional search/filter params)
- `POST /api/movies` - Add a new movie
- `PUT /api/movies/:id` - Update a movie
- `DELETE /api/movies/:id` - Delete a movie

### TV Series
- `GET /api/tv` - Get all TV series (with optional search/filter params)
- `POST /api/tv` - Add a new TV series
- `PUT /api/tv/:id` - Update a TV series
- `DELETE /api/tv/:id` - Delete a TV series

### AI/Ollama
- `GET /api/ollama/models` - List available Ollama models (filters out embeddings)
- `GET /api/ollama/status` - Check Ollama reachability and configured model
- `GET /api/recommendations` - Get AI recommendations
  - Query params: `type` (similar/hidden_gems/all), `content` (movie/tv/all), `model`, `refresh` (true/false)

### Analytics
- `GET /api/analytics` - Get analytics and recommendations
- `GET /api/tv/analytics` - Get TV-specific analytics

## 🤖 AI Troubleshooting

**AI recommendations not working:**
- Verify Ollama is running: `ollama serve` or check if process is active
- Check Ollama service is reachable at configured URL
- Ensure a model is installed: `ollama list`
- Pull a model if needed: `ollama pull qwen2.5:2b`
- Check backend logs for Ollama error messages
- Verify `OLLAMA_URL` and `OLLAMA_MODEL` in `.env` if configured

**Ollama timeouts:**
- Increase `OLLAMA_TIMEOUT_MS` in `.env` (default 480000 / 8 min) for slower systems
- Increase `OLLAMA_MODELS_TIMEOUT_MS` if model list times out
- Increase `OLLAMA_STATUS_TIMEOUT_MS` if status check times out
- Check system resources - Ollama needs CPU/memory to run models

**Models not appearing:**
- Refresh the model list in the UI
- Check Ollama is running and models are installed
- Some models (embedding models) are automatically filtered from the dropdown
- Pull new models with: `ollama pull <model-name>`

**AI gives poor recommendations:**
- Add more movies/TV to your database for better context
- Try a different model from the dropdown
- Use the "Refresh" button to clear cache and regenerate
- Both "Similar" and "Hidden Gems" types give different results - try both

## 🚀 Quick Start with Start Script

The easiest way to get started (handles everything automatically):

**Linux/macOS:**
```bash
./start.sh
```

**Windows:**
```batch
start.bat
```

Then open your browser to: `http://localhost:5173`

## 🎯 Tips

1. **Backup your data**: The `movies.db` file contains all your data. Regularly back it up!
2. **Port conflicts**: If ports 3000 or 5173 are in use, you can change them in:
    - Backend: `backend/server.js` (change `PORT` variable) or set `PORT` in `.env`
    - Frontend: `frontend/vite.config.js` (change `server.port`)
3. **AI models**: 
    - Smaller models (e.g., `qwen2.5:2b`) are faster but may be less nuanced
    - Larger models give better recommendations but are slower
    - Pull new models with: `ollama pull <model-name>`
4. **Persistent access**: For easy access from multiple devices, consider:
    - Setting up a static IP for your Linux PC
    - Creating a bookmark on your devices
    - Using a local DNS (optional)

## 🐛 Troubleshooting

**Backend won't start**:
- Check if port 3000 is already in use
- Ensure Node.js is installed: `node --version`

**Frontend won't start**:
- Check if port 5173 is already in use
- Ensure dependencies are installed: `cd frontend && npm install`

**Can't access from other devices**:
- Verify both devices are on the same WiFi network
- Check firewall settings:
  - Linux/macOS: `sudo ufw status`
  - Windows: `netsh advfirewall show allprofiles`
- Ensure ports are allowed (see above for platform-specific commands)
- Verify your IP address hasn't changed

**Movies/TV not saving**:
- Check backend is running
- Check browser console for errors
- Verify `movies.db` file exists and has write permissions
- Database auto-migrates on startup - schema changes handled automatically

## 📄 License

This project is open source and available for personal use.

## 🎉 Enjoy Your MILO!

Track your movies and TV series, and discover new favorites! 🍿