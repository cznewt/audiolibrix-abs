# audiolibrix-abs

Audiobookshelf custom metadata provider for [audiolibrix.com](https://www.audiolibrix.com/).

At the moment it supports the Czech and Slovak sites.

Container registry: https://github.com/cznewt/audiolibrix-abs/pkgs/container/audiolibrix-abs

## Fetching features

- Cover
- Title
- Author
- Publisher
- Published year
- Genres
- Language
- Duration
- Description
- **Narrator**

## Configuration

| Environment variable                   | Default | Description                                                             |
| -------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `LANGUAGE`                             | `cs`    | Audiolibrix locale to search: `cs` (Czech) or `sk` (Slovak). `cz` = `cs`. |
| `ADD_AUDIOLIBRIX_LINK_TO_DESCRIPTION`  | `true`  | Prepend a link to the Audiolibrix page to the description.              |
| `PORT`                                 | `3002`  | Port the provider listens on.                                           |

## Instructions to run locally

### Prerequisites

Docker and Docker Compose installed on your system.

### Setup and running

1. Create a `compose.yml` file in your desired directory with the following content

```yaml
---
services:
  audiolibrix-abs:
    image: ghcr.io/cznewt/audiolibrix-abs:main
    container_name: audiolibrix-abs
    environment:
      - LANGUAGE=cs # For Slovak users change to - LANGUAGE=sk
      - ADD_AUDIOLIBRIX_LINK_TO_DESCRIPTION=true # Optional: set to 'false' to omit the Audiolibrix link
    restart: unless-stopped
    ports:
      - "3002:3002"
```

2. Pull the latest Docker image

```
docker compose pull
```

3. Start the application

```
docker compose up -d
```

### Updating the Application

To update to the latest version:

```
docker compose pull
docker compose up -d
```

### To stop the application

```
docker compose down
```

### To view logs

```
docker compose logs -f
```

## How to use in AudiobookShelf

1. Navigate to your AudiobookShelf settings
2. Navigate to Item Metadata Utils
3. Navigate to Custom Metadata Providers
4. Click on Add
5. Name: whatever, for example `Audiolibrix`
6. URL: http://your-ip:3002
7. Authorization Header Value: whatever, but not blank, for example `00000`
8. Save
