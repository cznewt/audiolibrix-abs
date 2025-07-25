# audiolibrix-abs

Audiobookshelf custom metadata provider for ![audiolibrix.com](https://audiolibrix.com/).

At the moment it only supports Polish and Slovak sites.

Docker registry: https://github.com/cznewt/audiolibrix-abs/pkgs/container/audiolibrix-abs

## Fetching features

- Cover
- Title
- Author
- Publisher
- Series
- Genres
- Language
- Description
- **Lectors**
- **Audiobook cover**

## Instructions to run locally

### Prerequisites

Docker and Docker Compose installed on your system

### Setup and running

1. Create or copy from girhub a compose.yml file in your desired directory with the following content

```
---
services:
  audiolibrix-abs:
    image: ghcr.io/cznewt/audiolibrix-abs:main
    container_name: audiolibrix-abs
    environment:
      - LANGUAGE=cz # For Polish users: Change enviorment line to - LANGUAGE=sk
      - ADD_AUDIOLBRIX_LINK_TO_DESCRIPTION=true # Optional: Set to 'false' to remove the Audiolibrix link from the description
    restart: unless-stopped
    ports:
      - "3002:3002"
```

2. Pull the latest Docker images

```
docker-compose pull
```

3. Start the application

```
docker-compose up -d
```

### Updating the Application

To update to the latest version:

```
docker-compose pull
docker-compose up -d
```

### To stop the application

```
docker-compose down
```

### To view logs

```
docker-compose logs -f
```

## How to use in AudiobookShelf

1. Navigate to your AudiobookShelf settings
2. Navigate to Item Metadata Utils
3. Navigate to Custom Metadata Providers
4. Click on Add
5. Name: whatever for example AudioTeka
6. URL: http://your-ip:3002
7. Authorization Header Value: whatever, but not blank, for example 00000
8. Save
