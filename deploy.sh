#!/bin/sh
docker stop node-radio
docker rm node-radio
docker build -t node-radio .
docker compose up -d