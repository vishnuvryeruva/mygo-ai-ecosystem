#!/bin/bash

# Start Backend Server
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements from backend/requirements.txt
pip install -r requirements.txt -q

# Run the app
python app.py

