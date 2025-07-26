# Diet App

A comprehensive diet tracking application with AI-powered calorie lookup, meal logging, weight tracking, and blood pressure monitoring.

## Features

- 🍽️ **Meal Management**: Add and manage meal templates with calories and serving sizes
- 🤖 **AI Calorie Lookup**: Get calorie estimates for any food using Ollama AI
- 📝 **Daily Logging**: Log meals eaten and quick add items
- ⚖️ **Weight Tracking**: Daily weight logging with history
- ❤️ **Blood Pressure**: Monitor blood pressure readings with categorization
- 📊 **Analytics**: View daily calorie totals and calendar views
- 💾 **Local Storage**: All data stored locally in SQLite database

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Development Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd diet_app
   npm install
   ```

2. **Install Electron dependencies:**

   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```
   This will start both the backend server and Electron app.

### Production Build

1. **Build the application:**

   ```bash
   npm run dist
   ```

2. **Find the built application in the `dist` folder**

## Usage

### Starting the App

- **Development**: `npm run dev` (starts server + Electron)
- **Server only**: `npm run server` (for web browser access)
- **Production**: Run the built executable from `dist` folder

### Ollama Setup

The app uses Ollama for AI calorie lookup. If you encounter a 403 error:

1. The error message will show an IPv6 address
2. Add that IPv6 address to your Cloudflare allowlist
3. The app will automatically retry the request

### Database

The app uses SQLite for local data storage:

- Database file: `diet_app.db`
- Automatically created on first run
- No external database setup required

## Project Structure

```
diet_app/
├── main.js              # Electron main process
├── index.js             # Express server
├── public/              # Frontend files
│   ├── index.html       # Main HTML
│   ├── app.js           # Frontend JavaScript
│   └── icon.svg         # App icon
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Scripts

- `npm start` - Start Electron app (requires server running)
- `npm run dev` - Start both server and Electron
- `npm run server` - Start only the backend server
- `npm run build` - Build for distribution
- `npm run dist` - Create distributable packages

## Building for Different Platforms

The app can be built for:

- **Windows**: NSIS installer
- **macOS**: DMG package
- **Linux**: AppImage

Run `npm run dist` to build for your current platform.

## Troubleshooting

### Ollama Connection Issues

If you get 403 errors from Ollama:

1. Check the error message for the IPv6 address
2. Add that address to your Cloudflare allowlist
3. Restart the app

### Database Issues

If the database becomes corrupted:

1. Stop the app
2. Delete `diet_app.db`
3. Restart the app (new database will be created)

### Port Conflicts

If port 3000 is in use:

1. Change the port in `index.js`
2. Update the URL in `main.js`
3. Restart the app

## License

MIT License - see LICENSE file for details.
