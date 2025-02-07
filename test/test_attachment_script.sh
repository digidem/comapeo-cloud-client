#!/bin/bash
# Usage: ./test_attachment_script.sh <bearer_token>
# Example: ./test_attachment_script.sh test-token

# Default values and constants
HOST="http://localhost:8080"
PROJECT_NAME="My Attachment Test Project"
PROJECT_KEY="b277874b88825d52236022768afb98f9e2585082522d2d1289d94dcdadcd322f"
ENCRYPTION_KEY="ed6f980d737748a6b1e00bbe25c9e6a68abe4a5b69943ab4cc7de7d44457111f"

# Exit on error
set -e

if [ -z "$1" ]; then
    echo "Error: Bearer token required"
    echo "Usage: ./test_attachment_script.sh <bearer_token>"
    exit 1
fi

BEARER_TOKEN="$1"

echo "🧪 Starting Attachment API Tests..."
echo "========================"
echo

# Create a project to enable attachment testing
echo "PUT /projects"
echo "------------"
PROJECT_CREATE_RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "projectName": "'"${PROJECT_NAME}"'",
        "projectKey": "'"${PROJECT_KEY}"'",
        "encryptionKeys": {
            "auth": "'"${ENCRYPTION_KEY}"'",
            "config": "'"${ENCRYPTION_KEY}"'",
            "data": "'"${ENCRYPTION_KEY}"'",
            "blobIndex": "'"${ENCRYPTION_KEY}"'",
            "blob": "'"${ENCRYPTION_KEY}"'"
        }
    }' \
    "${HOST}/projects") || (echo "❌ Failed to create project" && exit 1)
echo "Response: ${PROJECT_CREATE_RESPONSE}"
echo "✅ Passed"
echo

# Retrieve the created project's ID
echo "GET /projects"
echo "------------"
PROJECTS_RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects")
echo "Response: ${PROJECTS_RESPONSE}"
FIRST_PROJECT_ID=$(echo "${PROJECTS_RESPONSE}" | jq -r '.data[0].projectId')
echo "Using project ID for attachments test: ${FIRST_PROJECT_ID}"
echo "✅ Passed"
echo

# Test GET /projects/:projectPublicId/attachments/:driveDiscoveryId/:type/:name
# Using dummy values for driveDiscoveryId, type, and name.
DRIVE_DISCOVERY_ID="testDrive"
ATTACHMENT_TYPE="image"
FILE_NAME="test.jpg"

echo "GET /projects/${FIRST_PROJECT_ID}/attachments/${DRIVE_DISCOVERY_ID}/${ATTACHMENT_TYPE}/${FILE_NAME}"
ATTACHMENT_RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" \
    "${HOST}/projects/${FIRST_PROJECT_ID}/attachments/${DRIVE_DISCOVERY_ID}/${ATTACHMENT_TYPE}/${FILE_NAME}") || (echo "❌ Failed attachments test" && exit 1)
echo "Response: ${ATTACHMENT_RESPONSE}"
echo "✅ Passed"
echo

echo "========================"
echo "🎉 Attachment API tests completed successfully!"
