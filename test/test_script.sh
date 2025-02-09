#!/bin/bash
# Usage: ./test_script.sh <bearer_token>
# Example: ./test_script.sh test-token

# Default values and constants
HOST="http://localhost:8080"
PROJECT_1_NAME="My Test Project 1"
PROJECT_1_KEY="b277874b88825d52236022768afb98f9e2585082522d2d1289d94dcdadcd322f"
PROJECT_2_NAME="My Test Project 2"
PROJECT_2_KEY="c277874b88825d52236022768afb98f9e2585082522d2d1289d94dcdadcd322f"
ENCRYPTION_KEY="ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f"
DETECTION_START="2023-01-01T00:00:00.000Z"
DETECTION_END="2023-01-02T00:00:00.000Z"
TEST_SOURCE_ID="test-source"

# Exit on error
set -e

if [ -z "$1" ]; then
    echo "Error: Bearer token required"
    echo "Usage: ./test_script.sh <bearer_token>"
    exit 1
fi

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
        "projectName": "'"${PROJECT_1_NAME}"'",
        "projectKey": "'"${PROJECT_1_KEY}"'",
        "encryptionKeys": {
            "auth": "'"${ENCRYPTION_KEY}"'",
            "config": "'"${ENCRYPTION_KEY}"'",
            "data": "'"${ENCRYPTION_KEY}"'",
            "blobIndex": "'"${ENCRYPTION_KEY}"'",
            "blob": "'"${ENCRYPTION_KEY}"'"
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

# Test PUT /projects with QR code
echo "PUT /projects with QR code"
echo "-------------------------"
RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "projectName": "'"${PROJECT_2_NAME}"'",
        "projectKey": "'"${PROJECT_2_KEY}"'",
        "encryptionKeys": {
            "auth": "'"${ENCRYPTION_KEY}"'",
            "config": "'"${ENCRYPTION_KEY}"'",
            "data": "'"${ENCRYPTION_KEY}"'",
            "blobIndex": "'"${ENCRYPTION_KEY}"'",
            "blob": "'"${ENCRYPTION_KEY}"'"
        }
    }' \
    "${HOST}/projects?qr=true") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects with QR code
echo "GET /projects with QR code"
echo "-------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects?qr=true")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Get first project's ID and name for subsequent tests
FIRST_PROJECT_ID=$(echo "${RESPONSE}" | jq -r '.data[0].projectId')
FIRST_PROJECT_NAME=$(echo "${RESPONSE}" | jq -r '.data[0].name')

# Test GET /projects/:projectId/settings
echo "GET /projects/${FIRST_PROJECT_ID}/settings"
echo "-----------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects/${FIRST_PROJECT_ID}/settings") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo


# Test GET /projects with projectId filter
echo "GET /projects with projectId filter"
echo "---------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects?projectId=${FIRST_PROJECT_ID}")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects with name filter
# URL encode the project name for use in query parameter
ENCODED_PROJECT_NAME=$(printf '%s' "${FIRST_PROJECT_NAME}" | jq -sRr @uri)
echo "Using encoded project name: ${ENCODED_PROJECT_NAME}"

echo "GET /projects with name filter ${FIRST_PROJECT_NAME}"
echo "----------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects?name=${ENCODED_PROJECT_NAME}")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo
# Save project ID for subsequent tests
PROJECT_ID=${FIRST_PROJECT_ID}
echo "Using project ID: ${PROJECT_ID}"
echo

# Test PUT /projects/:projectId/observation - create
echo "PUT /projects/${PROJECT_ID}/observation - create"
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

# Get versionId from response
# Parse response JSON to extract versionId
VERSION_ID=$(echo "${RESPONSE}" | jq -r '.versionId')
DOC_ID=$(echo "${RESPONSE}" | jq -r '.docId')
echo "Using version ID: ${VERSION_ID}"

# Test PUT /projects/:projectId/observation - update
echo "PUT /projects/${PROJECT_ID}/observation - update"
echo "-------------------------------------"
RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "tags": {
            "notes": "Updated observation",
            "category": "test"
        }
    }' \
    "${HOST}/projects/${PROJECT_ID}/observation?versionId=${VERSION_ID}") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Test PUT /projects/:projectId/observation - update using docId
echo "PUT /projects/${PROJECT_ID}/observation - update using docId"
echo "-------------------------------------"
RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "tags": {
            "notes": "Updated observation",
            "category": "test"
        }
    }' \
    "${HOST}/projects/${PROJECT_ID}/observation?docId=${DOC_ID}") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo


# Test GET /projects/:projectId/observations (Before Deletion)
echo "GET /projects/${PROJECT_ID}/observations (Before Deletion)"
echo "--------------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects/${PROJECT_ID}/observations")
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Extract the first observation's ID to delete from the response
OBSERVATION_ID=$(echo "${RESPONSE}" | jq -r '.data[0].docId')
echo "Observation to delete: ${OBSERVATION_ID}"
echo

echo "GET /projects/${PROJECT_ID}/observation/${OBSERVATION_ID}"
echo "--------------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects/${PROJECT_ID}/observation/${OBSERVATION_ID}") || (echo "❌ Failed to fetch observation by docId" && exit 1)
echo "Response: ${RESPONSE}"
echo "✅ Passed: Fetched observation by docId"
echo

# Test DELETE /projects/:projectId/observations/:observationId
echo "DELETE /projects/${PROJECT_ID}/observations/${OBSERVATION_ID}"
echo "--------------------------------------"
DELETE_RESPONSE=$(curl -s -f -X DELETE -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects/${PROJECT_ID}/observations/${OBSERVATION_ID}")
echo "Response: ${DELETE_RESPONSE}"
echo "✅ Passed"
echo

# Test GET /projects/:projectId/observations (After Deletion)
echo "GET /projects/${PROJECT_ID}/observations (After Deletion)"
echo "--------------------------------------"
RESPONSE_AFTER=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects/${PROJECT_ID}/observations")
echo "Response (all observations): ${RESPONSE_AFTER}"
echo

# Verify that the deleted observation is not present in the list
echo "Verifying that deleted observation is marked as deleted..."
if echo "${RESPONSE_AFTER}" | jq -e --arg id "$OBSERVATION_ID" '.data | map(select(.docId == $id and .deleted == true)) | length > 0' > /dev/null; then
  echo "✅ Verified: Deleted observation ${OBSERVATION_ID} is marked as deleted."
else
  echo "❌ Error: Deleted observation ${OBSERVATION_ID} is not marked as deleted!"
  exit 1
fi
echo
# Test POST /projects/:projectId/remoteDetectionAlerts
echo "POST /projects/${PROJECT_ID}/remoteDetectionAlerts"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -f -X POST \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "detectionDateStart": "'"${DETECTION_START}"'",
        "detectionDateEnd": "'"${DETECTION_END}"'",
        "sourceId": "'"${TEST_SOURCE_ID}"'",
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
