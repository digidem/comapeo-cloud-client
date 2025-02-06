#!/bin/bash
# Usage: ./test_script.sh <bearer_token>
# Example: ./test_script.sh test-token

# Default values and constants
HOST="http://localhost:8080"
# Generate random project name and phone number
RANDOM_NUM=$((RANDOM % 9000 + 1000))
PROJECT_NAME="Test Project ${RANDOM_NUM}"
RANDOM_PHONE="+1${RANDOM_NUM}5555555"
# Generate random 32-byte hex strings for keys
PROJECT_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Exit on error
set -e

if [ -z "$1" ]; then
    echo "Error: Bearer token required"
    echo "Usage: ./test_script.sh <bearer_token>"
    exit 1
fi

BEARER_TOKEN="$1"

echo "🧪 Starting AUTH API Tests..."
echo "========================"
echo

# Test POST /auth/register with existing number (should fail)
echo "POST /auth/register with existing number"
echo "----------------------------------------"
if curl -s -f -X POST \
  "${HOST}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "+1234567890",
    "projectName": "'"${PROJECT_NAME}"'"
  }' 2>/dev/null; then
  echo "❌ Failed: Request should have failed for existing number"
  exit 1
else
  echo "✅ Passed: Request failed as expected for existing number"
fi
echo

# Test POST /auth/register with new random number
echo "POST /auth/register with new number"
echo "----------------------------------------"
RESPONSE=$(curl -s -f -X POST \
  "${HOST}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "'"${RANDOM_PHONE}"'",
    "projectName": "'"${PROJECT_NAME}"'"
  }')
echo "Response: ${RESPONSE}"
echo "✅ Passed"
echo

# Create project for the registered coordinator
echo "PUT /projects for registered coordinator"
echo "----------------------------------------"
RESPONSE=$(curl -s -f -X PUT \
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
    "${HOST}/projects") || (echo "❌ Failed" && exit 1)
echo "Response: ${RESPONSE}"
PROJECT_ID=$(echo "${RESPONSE}" | jq -r '.data.projectId')
echo "Project ID: ${PROJECT_ID}"
echo "✅ Passed"
echo
# Verify project was created
echo "GET /projects to verify project exists"
echo "----------------------------------------"
RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects")
echo "Response: ${RESPONSE}"
if ! echo "${RESPONSE}" | jq -e ".data[] | select(.name == \"${PROJECT_NAME}\")" > /dev/null; then
  echo "❌ Failed: Project ${PROJECT_NAME} was not created"
  exit 1
fi
echo "✅ Passed: Project exists"
echo
# Test POST /auth/coordinator with new number
echo "POST /auth/coordinator"
echo "------------------------------------------"
RESPONSE=$(curl -s -f -X POST \
  "${HOST}/auth/coordinator" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "'"${RANDOM_PHONE}"'",
    "projectName": "'"${PROJECT_NAME}"'"
  }')
echo "Response: ${RESPONSE}"
COORDINATOR_TOKEN=$(echo "${RESPONSE}" | jq -r '.data.token')
echo "✅ Passed"
echo

# Test POST /auth/invitee with coordinator token
echo "POST /auth/member"
echo "------------------------------------------"
RESPONSE=$(curl -s -f -X POST \
  "${HOST}/auth/member" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${COORDINATOR_TOKEN}" \
  -d '{
    "coordPhoneNumber": "'"${RANDOM_PHONE}"'",
    "memberPhoneNumber": "'"${RANDOM_PHONE}2"'"
  }')
echo "Response: ${RESPONSE}"
MEMBER_TOKEN=$(echo "${RESPONSE}" | jq -r '.data.token')
echo "✅ Passed"
echo

echo "PUT /projects/${PROJECT_ID}/observation - create (using coordinator token)"
CREATE_RESPONSE=$(curl -s -f -X PUT \
  -H "Authorization: Bearer ${COORDINATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
        "lat": 13,
        "lon": 14,
        "tags": {
            "created_by": "coordinator"
        },
        "attachments": []
      }' \
  "${HOST}/projects/${PROJECT_ID}/observation") || (echo "❌ Failed to create observation" && exit 1)
echo "Response: ${CREATE_RESPONSE}"
echo "✅ Passed"

# Extract versionId from creation response
VERSION_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.versionId')
echo "Using version ID: ${VERSION_ID}"

echo "PUT /projects/${PROJECT_ID}/observation - update (using member token)"
UPDATE_RESPONSE=$(curl -s -f -X PUT \
  -H "Authorization: Bearer ${MEMBER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
        "tags": {
            "updated_by": "member",
            "notes": "Observation updated using member token"
        }
      }' \
  "${HOST}/projects/${PROJECT_ID}/observation?versionId=${VERSION_ID}") || (echo "❌ Failed to update observation" && exit 1)
echo "Response: ${UPDATE_RESPONSE}"
echo "✅ Passed"


echo "========================"
echo "🎉 All tests completed successfully!"
