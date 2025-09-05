#!/bin/bash

# Fantasy Football POC Startup Script

echo "🏈 ESPN Fantasy Football POC Startup"
echo "=================================="

# Check if we're in the right directory
if [ ! -d "server" ] || [ ! -d "client" ]; then
    echo "❌ Error: Please run this script from the fantasy-poc directory"
    exit 1
fi

echo "🔧 Starting backend server..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

echo "⏳ Waiting for server to start..."
sleep 3

# Test server health
if curl -s http://localhost:3003/health > /dev/null; then
    echo "✅ Backend server is running on http://localhost:3003"
else
    echo "❌ Backend server failed to start"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🚀 Starting frontend..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

echo ""
echo "✅ POC is starting up!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3003"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup INT

# Keep script running
wait