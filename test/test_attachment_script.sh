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

# Test POST /projects/:projectPublicId/whatsapp/attachments for audio attachment using mediaId "1662360301375693.ogg"
MEDIA_ID_AUDIO="1662360301375693.ogg"
echo "POST /projects/${FIRST_PROJECT_ID}/whatsapp/attachments with audio mediaId ${MEDIA_ID_AUDIO}"
WHATSAPP_RESPONSE_AUDIO=$(curl -s -f -X POST \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"mediaId": "'"${MEDIA_ID_AUDIO}"'"}' \
    "${HOST}/projects/${FIRST_PROJECT_ID}/whatsapp/attachments") || (echo "❌ Failed WhatsApp audio attachments test" && exit 1)
echo "Response: ${WHATSAPP_RESPONSE_AUDIO}"
echo "✅ Audio WhatsApp attachment added"
echo

# Extract attachment details from the audio response for GET request
AUDIO_DRIVE_ID=$(echo "${WHATSAPP_RESPONSE_AUDIO}" | jq -r '.driveId')
AUDIO_ATTACHMENT_TYPE=$(echo "${WHATSAPP_RESPONSE_AUDIO}" | jq -r '.type')
AUDIO_FILE_NAME=$(echo "${WHATSAPP_RESPONSE_AUDIO}" | jq -r '.name')

echo "GET /projects/${FIRST_PROJECT_ID}/attachments/${AUDIO_DRIVE_ID}/${AUDIO_ATTACHMENT_TYPE}/${AUDIO_FILE_NAME}"
AUDIO_ATTACHMENT_RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" \
    "${HOST}/projects/${FIRST_PROJECT_ID}/attachments/${AUDIO_DRIVE_ID}/${AUDIO_ATTACHMENT_TYPE}/${AUDIO_FILE_NAME}") || (echo "❌ Failed audio attachments GET test" && exit 1)
echo "Response: ${AUDIO_ATTACHMENT_RESPONSE}"
echo "✅ GET audio attachments passed"
echo

# Test POST /projects/:projectPublicId/whatsapp/attachments for image attachment using mediaId "506761729122033.jpg"
MEDIA_ID_IMAGE="506761729122033.jpg"
echo "POST /projects/${FIRST_PROJECT_ID}/whatsapp/attachments with image mediaId ${MEDIA_ID_IMAGE}"
WHATSAPP_RESPONSE_IMAGE=$(curl -s -f -X POST \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"mediaId": "'"${MEDIA_ID_IMAGE}"'"}' \
    "${HOST}/projects/${FIRST_PROJECT_ID}/whatsapp/attachments") || (echo "❌ Failed WhatsApp image attachments test" && exit 1)
echo "Response: ${WHATSAPP_RESPONSE_IMAGE}"
echo "✅ Image WhatsApp attachment added"
echo

# Extract attachment details from the image response for GET request
IMAGE_DRIVE_ID=$(echo "${WHATSAPP_RESPONSE_IMAGE}" | jq -r '.driveId')
IMAGE_ATTACHMENT_TYPE=$(echo "${WHATSAPP_RESPONSE_IMAGE}" | jq -r '.type')
IMAGE_FILE_NAME=$(echo "${WHATSAPP_RESPONSE_IMAGE}" | jq -r '.name')

echo "GET /projects/${FIRST_PROJECT_ID}/attachments/${IMAGE_DRIVE_ID}/${IMAGE_ATTACHMENT_TYPE}/${IMAGE_FILE_NAME}"
IMAGE_ATTACHMENT_RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" \
    "${HOST}/projects/${FIRST_PROJECT_ID}/attachments/${IMAGE_DRIVE_ID}/${IMAGE_ATTACHMENT_TYPE}/${IMAGE_FILE_NAME}") || (echo "❌ Failed image attachments GET test" && exit 1)
echo "Response: ${IMAGE_ATTACHMENT_RESPONSE}"
echo "✅ GET image attachments passed"
echo

# Create observation with no attachments initially
echo "PUT /projects/${FIRST_PROJECT_ID}/observation - create observation"
OBSERVATION_CREATE_RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
          "lat": 37.7749,
          "lon": -122.4194,
          "attachments": []
        }' \
    "${HOST}/projects/${FIRST_PROJECT_ID}/observation") || (echo "❌ Failed to create observation" && exit 1)
echo "Response: ${OBSERVATION_CREATE_RESPONSE}"

OBSERVATION_VERSION_ID=$(echo "${OBSERVATION_CREATE_RESPONSE}" | jq -r '.versionId')
echo "Created observation with versionId: ${OBSERVATION_VERSION_ID}"
echo "✅ Observation creation passed"
echo

# Update observation with both audio and image attachments
echo "PUT /projects/${FIRST_PROJECT_ID}/observation - update observation with attachments"
OBSERVATION_UPDATE_RESPONSE=$(curl -s -f -X PUT \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
          "attachments": [
            {
              "driveDiscoveryId": "'"${AUDIO_DRIVE_ID}"'",
              "type": "'"${AUDIO_ATTACHMENT_TYPE}"'",
              "name": "'"${AUDIO_FILE_NAME}"'"
            },
            {
              "driveDiscoveryId": "'"${IMAGE_DRIVE_ID}"'",
              "type": "'"${IMAGE_ATTACHMENT_TYPE}"'",
              "name": "'"${IMAGE_FILE_NAME}"'"
            }
          ]
        }' \
    "${HOST}/projects/${FIRST_PROJECT_ID}/observation?versionId=${OBSERVATION_VERSION_ID}") || (echo "❌ Failed to update observation with attachments" && exit 1)
echo "Response: ${OBSERVATION_UPDATE_RESPONSE}"
echo "✅ Observation update with attachments passed"
echo


echo "========================"
echo "🎉 Attachment API tests completed successfully!"
