#!/bin/bash
# Download Dependencies for ABAP AI Assistant Plugin

echo "================================================"
echo "ABAP AI Assistant - Dependency Download Script"
echo "================================================"
echo ""

# Create lib directory if it doesn't exist
mkdir -p lib

# Download org.json library
echo "Downloading org.json library..."
curl -L -o lib/org.json-20240303.jar \
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"

if [ $? -eq 0 ]; then
    echo "✓ Successfully downloaded org.json-20240303.jar"
else
    echo "✗ Failed to download org.json library"
    echo "  Please download manually from:"
    echo "  https://mvnrepository.com/artifact/org.json/json/20240303"
    exit 1
fi

echo ""
echo "================================================"
echo "All dependencies downloaded successfully!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Import this project into Eclipse"
echo "2. Run As > Eclipse Application"
echo "3. Configure your OpenAI API key in preferences"
echo ""


