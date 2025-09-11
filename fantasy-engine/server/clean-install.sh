#!/bin/bash

echo "Cleaning server dependencies..."
rm -rf node_modules package-lock.json

echo "Installing fresh dependencies..."
npm install

echo "Running security audit..."
npm audit

echo "Installation complete!"