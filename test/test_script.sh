#!/bin/bash
# Usage: ./test_script.sh <bearer_token>
# Example: ./test_script.sh test-token

# Exit on error
set -e

if [ -z "$1" ]; then
    echo "Error: Bearer token required"
    echo "Usage: ./test_script.sh <bearer_token>"
    exit 1
fi

# Default values
HOST="http://localhost:8080"
BEARER_TOKEN="$1"

echo "🧪 Starting API Tests..."
echo "========================"
echo

# Test GET /
echo "GET /"
echo "-----"
RESPONSE=$(curl -s -f "${HOST}/")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /info
echo "GET /info" 
echo "---------"
RESPONSE=$(curl -s -f "${HOST}/info")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test PUT /projects
echo "PUT /projects"
echo "------------"
RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "projectName": "My Test Project 1",
        "projectKey": "b277874b88825d52236022768afb98f9e2585082522d2d1289d94dcdadcd322f",
        "encryptionKeys": {
            "auth": "ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f",
            "config": "ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f",
            "data": "ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f", 
            "blobIndex": "ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f",
            "blob": "ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f"
        }
    }' \
    "${HOST}/projects") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects
echo "GET /projects"
echo "------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Save project ID for subsequent tests
PROJECT_ID=$(echo "${RESPONSE}" | jq -r '.data[0].projectId')
echo "Using project ID: ${PROJECT_ID}"
echo

# Test PUT /projects/:projectId/observation
echo "PUT /projects/${PROJECT_ID}/observation"
echo "-------------------------------------"
RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "lat": 0,
        "lon": 0,
        "tags": {},
        "attachments": []
    }' \
    "${HOST}/projects/${PROJECT_ID}/observation") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects/:projectId/observations
echo "GET /projects/${PROJECT_ID}/observations"
echo "--------------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" \
    "${HOST}/projects/${PROJECT_ID}/observations")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test POST /projects/:projectId/remoteDetectionAlerts
echo "POST /projects/${PROJECT_ID}/remoteDetectionAlerts"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -f -X POST \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "detectionDateStart": "2023-01-01T00:00:00.000Z",
        "detectionDateEnd": "2023-01-02T00:00:00.000Z",
        "sourceId": "test-source",
        "metadata": {},
        "geometry": {
            "type": "Point",
            "coordinates": [0, 0]
        }
    }' \
    "${HOST}/projects/${PROJECT_ID}/remoteDetectionAlerts") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects/:projectId/remoteDetectionAlerts
echo "GET /projects/${PROJECT_ID}/remoteDetectionAlerts"
echo "----------------------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" \
    "${HOST}/projects/${PROJECT_ID}/remoteDetectionAlerts")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

echo "========================"
echo "🎉 All tests completed successfully!"
