📻 Node-Radio
A sleek and modern web application for browsing and streaming radio stations powered by Radio-Browser.

✨ Features
🔍 Explore & Discover – Search the extensive Radio-Browser database to find your favorite stations.
⭐ Favorites – Easily add stations to your favorites for quick access.
🎵 Spectrum Visualizer – Enjoy a dynamic audio visualization while listening.
🎛️ Chrome Media Session Support – Control playback directly from your device's media controls.
📡 Live Metadata – Display now-playing information (when available).
📲 Progressive Web App (PWA) – Install the app for a native-like experience (requires HTTPS).

![Projekt Screenshot](screenshot.png)

## 🚀 Installation 

### Docker compose

1. Create docker-compose.yml
```shsh
touch docker-compose.yml
```

2. Insert into docker-compose.yml (change password to your needs):
```
services:
  node-radio:
    image: kolstr/node-radio
    container_name: node-radio
    restart: unless-stopped
    environment:
      PASSWORD: node-radio
    ports:
      - "3000:3000"
    volumes:
      - node_radio:/app/data
```

3. Start container
```sh
docker compose up -d
```
The application now runs on http://localhost:3000

### Build image manually from repository

1. Clone the repository
```sh
git clone https://git.kolstr.net/kolstr/node-radio.git
```

2. Navigate into the project directory
```sh
cd node-radio
```

3. Create .env file
```shsh
touch .env
```

4. Insert passwort configuration to .env file
```
PASSWORD=node-radio
```

5. Build docker image
```sh
docker build -t node-radio .
```

6. Start container
```sh
docker compose up -d
```

The application now runs on http://localhost:3000

## 📖 Usage
- Initially the favourites file is empty, so you wil see no stations.
- Select the upper right dropdown and search for stations. 
- Select a station from the results and add it to the favourites via the dropdown.

## 🛠️ Technologie Stack
| Category     |  |
|-------------|------------|
| Frontend    | ![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white) |
| Backend     | ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)  |
| CI/CD       | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) | 

## 📌 Credits
- Radio-Browser: https://www.radio-browser.info/
- Radiolise: https://gitlab.com/radiolise/radiolise.gitlab.io
- Audiomotion: https://github.com/hvianna/audioMotion.js/
