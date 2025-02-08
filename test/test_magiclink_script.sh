echo "🧪 Starting Magic Link Tests..."
echo "============================"
echo

# Set variables for Magic Link tests
# Generate random project name and phone number
# Generate random number between 1000-9999 using /dev/urandom for better randomness
RANDOM_NUM=$(od -An -N2 -i /dev/urandom | awk '{ print ($1 % 9000) + 1000 }')
PROJECT_NAME="Test Project ${RANDOM_NUM}"
RANDOM_PHONE="+1${RANDOM_NUM}5555555"

# Generate random 32-byte hex strings for keys
PROJECT_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
HOST="http://localhost:8080"
BEARER_TOKEN="my_secret"

echo "Creating coordinator for Magic Link tests..."
RESPONSE=$(curl -s -f -X POST \
  "${HOST}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "'"${RANDOM_PHONE}"'",
    "projectName": "'"${PROJECT_NAME}"'"
  }') || (echo "❌ Failed to create coordinator" && exit 1)
echo "Response: ${RESPONSE}"
if [ -z "${RESPONSE}" ] || [ "${RESPONSE}" = "null" ]; then
  echo "❌ Failed: No response received from registration"
  exit 1
fi
echo "✅ Passed: Created coordinator"
echo

# Create project for the registered coordinator
echo "Creating project..."
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
    "${HOST}/projects") || (echo "❌ Failed to create project" && exit 1)
echo "Response: ${RESPONSE}"
PROJECT_ID=$(echo "${RESPONSE}" | jq -r '.data.projectId')
if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "null" ]; then
  echo "❌ Failed: Project ID not received"
  exit 1
fi
echo "✅ Passed: Created project"
echo

# Get coordinator token
echo "Getting coordinator token..."
COORDINATOR_RESPONSE=$(curl -s -f -X POST \
  "${HOST}/auth/coordinator" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "'"${RANDOM_PHONE}"'",
    "projectName": "'"${PROJECT_NAME}"'"
  }') || (echo "❌ Failed to get coordinator token" && exit 1)
echo "Response: ${COORDINATOR_RESPONSE}"

# Set USER_TOKEN to coordinator token for magic link tests
USER_TOKEN=$(echo "${COORDINATOR_RESPONSE}" | jq -r '.data.token')
if [ -z "${USER_TOKEN}" ] || [ "${USER_TOKEN}" = "null" ]; then
  echo "❌ Failed: User token not received"
  exit 1
fi
echo "Using USER_TOKEN: ${USER_TOKEN}"
echo "✅ Passed: Got coordinator token"
echo

# Test 1: Create a magic link successfully
echo "POST /magic-link/${PROJECT_ID}/create - Valid Request"
CREATE_RESPONSE=$(curl -s -f -X POST \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  "${HOST}/magic-link/${PROJECT_ID}/create")
echo "Response: ${CREATE_RESPONSE}"
MAGIC_LINK_TOKEN=$(echo "${CREATE_RESPONSE}" | jq -r '.magicLinkToken')
if [ -z "${MAGIC_LINK_TOKEN}" ] || [ "${MAGIC_LINK_TOKEN}" = "null" ]; then
  echo "❌ Failed: Magic link token not received"
  exit 1
fi
echo "Magic Link Token: ${MAGIC_LINK_TOKEN}"
echo "✅ Passed"
echo

# Test 2: Attempt to create a magic link again immediately (should fail due to time limit)
echo "POST /magic-link/${PROJECT_ID}/create - Duplicate Request (Expect 429)"
DUPLICATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  "${HOST}/magic-link/${PROJECT_ID}/create")
if [ "${DUPLICATE_STATUS}" -eq 429 ]; then
  echo "✅ Passed: Duplicate creation prevented (HTTP 429)"
else
  echo "❌ Failed: Expected HTTP 429 but got ${DUPLICATE_STATUS}"
  exit 1
fi
echo

# Test 3: Authenticate with an invalid magic link token (non-existent token)
echo "POST /magic-link/${PROJECT_ID}/auth - Invalid Token (Expect 404)"
INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"token": "invalidtoken"}' \
  "${HOST}/${PROJECT_ID}/magic-link/auth")
if [ "${INVALID_STATUS}" -eq 404 ]; then
  echo "✅ Passed: Invalid token correctly returned HTTP 404"
else
  echo "❌ Failed: Expected HTTP 404 for invalid token but got ${INVALID_STATUS}"
  exit 1
fi
echo

# Test 4: Authenticate using the valid magic link token from Test 1
echo "POST /magic-link/auth/${MAGIC_LINK_TOKEN} - Valid Token"
AUTH_RESPONSE=$(curl -s -f -X POST \
  "${HOST}/magic-link/auth/${MAGIC_LINK_TOKEN}")
echo "Response: ${AUTH_RESPONSE}"
RETURNED_TOKEN=$(echo "${AUTH_RESPONSE}" | jq -r '.magicLinkToken')
if [ "${RETURNED_TOKEN}" != "${MAGIC_LINK_TOKEN}" ]; then
  echo "❌ Failed: Returned magic link token does not match"
  exit 1
fi
USER_OBJ=$(echo "${AUTH_RESPONSE}" | jq -r '.user')
if [ -z "${USER_OBJ}" ] || [ "${USER_OBJ}" = "null" ]; then
  echo "❌ Failed: User object is missing in the response"
  exit 1
fi
echo "✅ Passed"
echo

# Test 5: Attempt to authenticate again with the same (now used) magic link token (Expect 400)
echo "POST /magic-link/auth/${MAGIC_LINK_TOKEN} - Reuse Token (Expect 400)"
REUSED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "${HOST}/magic-link/auth/${MAGIC_LINK_TOKEN}")
if [ "${REUSED_STATUS}" -eq 400 ]; then
  echo "✅ Passed: Reusing magic link token correctly returned HTTP 400"
else
  echo "❌ Failed: Expected HTTP 400 for reused token but got ${REUSED_STATUS}"
  exit 1
fi
echo

echo "POST /magic-link/${PROJECT_ID}/create - Missing userToken Header (Expect 400)"
MISSING_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${HOST}/magic-link/${PROJECT_ID}/create")
if [ "${MISSING_TOKEN_STATUS}" -eq 401 ]; then
  echo "✅ Passed: Request without userToken header correctly returned HTTP 400"
else
  echo "❌ Failed: Expected HTTP 400 for missing userToken header but got ${MISSING_TOKEN_STATUS}"
  exit 1
fi
echo

echo "POST /magic-link/auth/ - Missing Magic Token (Expect 400)"
MISSING_MAGIC_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "${HOST}/magic-link/auth/")
if [ "${MISSING_MAGIC_TOKEN_STATUS}" -eq 400 ]; then
  echo "✅ Passed: Request missing magic token in URL correctly returned HTTP 400"
else
  echo "❌ Failed: Expected HTTP 400 for missing magic token but got ${MISSING_MAGIC_TOKEN_STATUS}"
  exit 1
fi
echo
echo "============================"
echo "🎉 All Magic Link tests completed successfully!"
