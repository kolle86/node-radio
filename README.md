# node_radio
Web frontend for radio stations provided by radio-browser.

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
    image: node_radio
    container_name: node-radio
    restart: unless-stopped
    environment:
      PASSWORD: node_radio
    ports:
      - "3000:3000"
    volumes:
      - ~/node_radio:/app/data
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