# Leichtgewichtiges Node.js-Image verwenden
FROM node:22-slim

# Arbeitsverzeichnis setzen
WORKDIR /app

# Nur notwendige Dateien kopieren
COPY package*.json ./

ENV NODE_ENV=production

# Produktionabhängigkeiten installieren
RUN npm ci --only=production && npm cache clean --force

# Restlichen Code kopieren
COPY . .

# Port freigeben
EXPOSE 3000

# Startbefehl
CMD ["node", "index.js"]
