#!/bin/bash

# Prompt for variables
read -p "Enter host (e.g., https://comapeo.luandro.com): " HOST
read -p "Enter Bearer token: " BEARER_TOKEN
read -p "Enter phone number (e.g., +5562996045772): " PHONE_NUMBER
read -p "Enter project name: " PROJECT_NAME

echo "Test 1: Registering new user..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${HOST}/auth/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
    "phoneNumber": "'"${PHONE_NUMBER}"'",
    "projectName": "'"${PROJECT_NAME}"'"
  }')
if [ "$STATUS" -eq 200 ]; then
  echo "✅ Test 1 Passed: User registration successful."
else
  echo "❌ Test 1 Failed: Registration returned status $STATUS."
  exit 1
fi

echo "Registered successfully, now go ahead and create your projcect ${PROJECT_NAME} on the CoMapeo app."
echo "Waiting for project to be created..."

while true; do
  RESPONSE=$(curl -s -f -H "Authorization: Bearer ${BEARER_TOKEN}" "${HOST}/projects?name=${PROJECT_NAME}" || echo "")
  
  if [ ! -z "$RESPONSE" ]; then
    # Try to extract project ID and name
    PROJECT_ID=$(echo "${RESPONSE}" | jq -r '.data[0].projectId')
    PROJECT_NAME=$(echo "${RESPONSE}" | jq -r '.data[0].name')
    
    if [ ! -z "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
      echo "Project found! ID: ${PROJECT_ID}, Name: ${PROJECT_NAME}"
      break
    fi
  fi
  
  echo "Project not found yet, retrying in 5 seconds..."
  sleep 5
done

echo


# read -p "Enter coordinator token (if applicable): " CORD_TOKEN
# read -p "Enter media ID (e.g., 1662360301375693.ogg): " MEDIA_ID
# read -p "Enter drive discovery ID: " DRIVE_ID
# read -p "Enter attachment type (e.g., audio): " ATTACHMENT_TYPE
# read -p "Enter attachment name: " ATTACHMENT_NAME
# read -p "Enter observation version ID: " VERSION_ID
# read -p "Enter observation ID to delete: " OBSERVATION_ID

# echo ""
# echo "Starting tests..."
# echo ""

# # Test 1: User Registration

# # Test 2: Retrieve Projects
# echo "Test 2: Fetching projects..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
#   "${HOST}/projects" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer ${BEARER_TOKEN}")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 2 Passed: Projects retrieved successfully."
# else
#   echo "❌ Test 2 Failed: Projects retrieval returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 3: Coordinator Registration
# echo "Test 3: Registering coordinator..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
#   "${HOST}/auth/coordinator" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   -d '{
#     "phoneNumber": "'"${PHONE_NUMBER}"'",
#     "projectName": "'"${PROJECT_NAME}"'"
#   }')
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 3 Passed: Coordinator registration successful."
# else
#   echo "❌ Test 3 Failed: Coordinator registration returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 4: Fetch Project Settings
# echo "Test 4: Retrieving project settings..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   "${HOST}/projects/${PROJECT}/settings?locale=pt")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 4 Passed: Project settings retrieved successfully."
# else
#   echo "❌ Test 4 Failed: Project settings retrieval returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 5: Create New Observation
# echo "Test 5: Creating observation..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "lat": 3,
#     "lon": 15,
#     "tags": { 
#       "notes": "New observation"
#     },
#     "attachments": []
#   }' \
#   "${HOST}/projects/${PROJECT}/observation?category=mineracao&locale=pt")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 5 Passed: Observation created successfully."
# else
#   echo "❌ Test 5 Failed: Observation creation returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 6: Add WhatsApp Attachment
# echo "Test 6: Adding WhatsApp attachment..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{"mediaId": "'"${MEDIA_ID}"'"}' \
#   "${HOST}/projects/${PROJECT}/whatsapp/attachments")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 6 Passed: WhatsApp attachment added successfully."
# else
#   echo "❌ Test 6 Failed: WhatsApp attachment returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 7: Update Observation with Attachment
# echo "Test 7: Updating observation with attachment..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "tags": {
#       "notes": "Updated observation"
#     },
#     "attachments": [
#       {
#         "driveDiscoveryId": "'"${DRIVE_ID}"'",
#         "type": "'"${ATTACHMENT_TYPE}"'",
#         "name": "'"${ATTACHMENT_NAME}"'"
#       }
#     ]
#   }' \
#   "${HOST}/projects/${PROJECT}/observation?category=extracao-de-gas&locale=pt&versionId=${VERSION_ID}")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 7 Passed: Observation updated with attachment successfully."
# else
#   echo "❌ Test 7 Failed: Observation update returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 8: Retrieve Observations
# echo "Test 8: Fetching observations..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
#   "${HOST}/projects/${PROJECT}/observations" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer ${BEARER_TOKEN}")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 8 Passed: Observations fetched successfully."
# else
#   echo "❌ Test 8 Failed: Observations retrieval returned status $STATUS."
#   exit 1
# fi
# echo ""

# # Test 9: Delete Observation
# echo "Test 9: Deleting observation with ID ${OBSERVATION_ID}..."
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
#   -H "Authorization: Bearer ${BEARER_TOKEN}" \
#   "${HOST}/projects/${PROJECT}/observations/${OBSERVATION_ID}")
# if [ "$STATUS" -eq 200 ]; then
#   echo "✅ Test 9 Passed: Observation deleted successfully."
# else
#   echo "❌ Test 9 Failed: Observation deletion returned status $STATUS."
#   exit 1
# fi
# echo ""

# echo "All tests completed successfully!"