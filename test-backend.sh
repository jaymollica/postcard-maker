#!/bin/bash

echo "Testing Backend API Endpoints..."
echo "================================"
echo ""

# Test 1: Nonce endpoint
echo "1. Testing /nonce endpoint..."
NONCE_RESPONSE=$(curl -s -X POST http://localhost:9999/nonce -H "Content-Type: application/json")
echo "$NONCE_RESPONSE"
NONCE=$(echo $NONCE_RESPONSE | grep -o '"nonce":"[^"]*' | cut -d'"' -f4)
echo ""

# Test 2: Cost endpoint (US)
echo "2. Testing /cost endpoint (US pricing)..."
curl -s -X POST http://localhost:9999/cost \
  -H "Content-Type: application/json" \
  -d "{\"nonce\":\"$NONCE\",\"artistUrl\":\"http://localhost:3000\",\"country\":\"US\"}"
echo ""
echo ""

# Test 3: Cost endpoint (International)
echo "3. Testing /cost endpoint (International pricing)..."
curl -s -X POST http://localhost:9999/cost \
  -H "Content-Type: application/json" \
  -d "{\"nonce\":\"$NONCE\",\"artistUrl\":\"http://localhost:3000\",\"country\":\"CA\"}"
echo ""
echo ""

echo "================================"
echo "Backend tests complete!"
echo ""
echo "Expected results:"
echo "- US pricing: 1 cent (0.01)"
echo "- International pricing: 500 cents (5.00)"
