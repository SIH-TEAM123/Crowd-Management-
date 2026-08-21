# Crowd Management Frontend (Symmetry)

A modern, responsive, glassmorphism-inspired web frontend for the Symmetry Crowd Management System. Designed for high usability, real-time queue visualizers, appointment management, facility crowd density tracking, user notifications, and profile settings.

## Technology Stack
- **Structure**: HTML5
- **Styling**: Modern Vanilla CSS (Google Fonts Inter, dark mode aesthetics, responsive media queries)
- **Logic**: Modern Modular JavaScript (ES6+)
- **Backend Architecture**: Designed to interface with a FastAPI backend (`http://127.0.0.1:8000`)

## Included Pages & Components
- **`index.html`**: Authentication portal (Login & Google OAuth demo)
- **`dashboard.html`**: Overview metrics, live clock, quick actions, and crowd graphs
- **`appointments.html`**: Upcoming & past appointment management and booking interface
- **`queue.html`**: Real-time token queue status, position tracker, and wait time counter
- **`crowd.html`**: Facility crowd density metrics, visual indicator dots, and trend analysis
- **`notifications.html`**: Categorized user notifications, unread badges, and read state toggles
- **`profile.html`**: User account settings, profile editing, and security controls

## How to Run Locally

### Option 1: Live Server / Any Static HTTP Server
Using Node (`npx`):
```bash
cd crowd-management-frontend
npx http-server . -p 8080
```
Or using Python:
```bash
cd crowd-management-frontend
python -m http.server 8080
```
Open `http://localhost:8080` in your web browser.

### Option 2: Directly via File System
Open `index.html` or `dashboard.html` directly in any standard browser.

## FastAPI Backend Integration
The API communication layer is centralized in `js/api.js`:
```js
const API_BASE_URL = 'http://127.0.0.1:8000';
```
When connecting the FastAPI backend service, API endpoints can be referenced directly through `API_BASE_URL`.
