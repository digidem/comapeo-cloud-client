# @comapeo/cloud

A self-hosted cloud server for CoMapeo.

## Deploying CoMapeo Cloud

CoMapeo Cloud comes with a [`Dockerfile`](./Dockerfile) that can be used to build a Docker image. This image can be used to deploy CoMapeo Cloud on a server.

Server configuration is done using environment variables. The following environment variables are available:

| Environment Variable  | Required | Description                                                          | Default Value    |
| --------------------- | -------- | -------------------------------------------------------------------- | ---------------- |
| `SERVER_BEARER_TOKEN` | Yes      | Token for authenticating API requests. Should be large random string |                  |
| `PORT`                | No       | Port on which the server runs                                        | `8080`           |
| `SERVER_NAME`         | No       | Friendly server name, seen by users when adding server               | `CoMapeo Server` |
| `ALLOWED_PROJECTS`    | No       | Number of projects allowed to register with the server               | `1`              |
| `STORAGE_DIR`         | No       | Path for storing app & project data                                  | `$CWD/data`      |

### Deploying with fly.io

CoMapeo Cloud can be deployed on [fly.io](https://fly.io) using the following steps:

1. Install the flyctl CLI tool by following the instructions [here](https://fly.io/docs/getting-started/installing-flyctl/).
2. Create a new app on fly.io by running `flyctl apps create`, take a note of the app name.
3. Set the SERVER_BEARER_TOKEN secret via:
   ```sh
   flyctl secrets set SERVER_BEARER_TOKEN=<your-secret> --app <your-app-name>
   ```
4. Deploy the app by running (optionally setting the `ALLOWED_PROJECTS` environment variable):
   ```sh
   flyctl deploy --app <your-app-name> -e ALLOWED_PROJECTS=10
   ```
5. The app should now be running on fly.io. You can access it at `https://<your-app-name>.fly.dev`.

To destroy the app (delete all data and project invites), run:

> [!WARNING]
> This action is irreversible and will permanently delete all data associated with the app, and projects that have already added the server will no longer be able to sync with it.

```sh
flyctl destroy --app <your-app-name>
```

## Usage

### API Examples

All API requests require a Bearer token that matches the `SERVER_BEARER_TOKEN` environment variable.

In the examples below, replace `<SERVER_BEARER_TOKEN>` with your actual token, `<yourserver.com>` with your server's address, and provide the necessary data for each request.

#### Add a Project

To add a new project to the server, send a POST request to `/projects` with the project details.

```bash
curl -X PUT https://yourserver.com/projects \
  -H "Authorization: Bearer <SERVER_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "Your Project Name",
    "projectKey": "<hex-encoded project key>",
    "encryptionKeys": {
      "auth": "<hex-encoded auth key>",
      "config": "<hex-encoded config key>",
      "data": "<hex-encoded data key>",
      "blobIndex": "<hex-encoded blobIndex key>",
      "blob": "<hex-encoded blob key>"
    }
  }'
```

#### Get Projects

```bash
curl \
  -H 'Authorization: Bearer <SERVER_BEARER_TOKEN>' \
  'https://yourserver.com/projects'
```

#### Create an Observation

Add a new observation to a project by sending a POST request to `/projects/:projectPublicId/observations` with the observation data.

```bash
curl -X PUT https://yourserver.com/projects/<projectPublicId>/observations \
  -H "Authorization: Bearer <SERVER_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": <latitude>,
    "lon": <longitude>,
    "attachments": [
      {
        "driveDiscoveryId": "<driveDiscoveryId>",
        "type": "photo",
        "name": "<filename>"
      }
    ],
    "tags": ["tag1", "tag2"]
  }'
```

#### Get Observations

Retrieve observations for a project by sending a GET request to `/projects/:projectPublicId/observations`.

```bash
curl -X GET https://yourserver.com/projects/<projectPublicId>/observations \
  -H "Authorization: Bearer <SERVER_BEARER_TOKEN>"
```

Replace `<projectPublicId>` with the public ID of your project.

#### Get an Attachment

Fetch an attachment associated with an observation.

```bash
curl -X GET "https://yourserver.com/projects/<projectPublicId>/attachments/<driveDiscoveryId>/<type>/<name>?variant=<variant>" \
  -H "Authorization: Bearer <SERVER_BEARER_TOKEN>"
```

- Replace `<projectPublicId>` with your project's public ID.
- Replace `<driveDiscoveryId>` with the drive discovery ID of the attachment.
- Replace `<type>` with the attachment type (`photo` or `audio`).
- Replace `<name>` with the attachment file name.
- `<variant>` is optional and can be `original`, `preview`, or `thumbnail` for photos. For audio, only `original` is valid.

#### Create a Remote Alert

Send a POST request to `/projects/:projectPublicId/remoteDetectionAlerts` with the alert data.

```bash
curl -X POST https://yourserver.com/projects/<projectPublicId>/remoteDetectionAlerts \
  -H "Authorization: Bearer <SERVER_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "detectionDateStart": "<ISO timestamp>",
    "detectionDateEnd": "<ISO timestamp>",
    "sourceId": "<source id>",
    "metadata": {
      "alert_type": "<alert type>"
    },
    "geometry": {
      "type": "Point",
      "coordinates": [<longitude>, <latitude>]
    }
  }'
```

#### Healthcheck

Check the health of the server by making a GET request to `/healthcheck`. This endpoint does not require authentication.

```bash
curl -X GET https://yourserver.com/healthcheck
```
