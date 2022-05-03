# Jekyll ↔ Notion Sync

This is a Docker container that syncs your Jekyll site using Notion.

## Usage

To use this container, you need to use some environment variables:

- `NOTION_TOKEN`: The token to access Notion.
- `NOTION_USER`: The owner of the Notion page.
- `GITHUB_TOKEN`: The token to access GitHub.
- `GITHUB_OWNER`: The owner of the GitHub repository.
- `GITHUB_REPO`: The name of the GitHub repository containsing the Jekyll site.
- `GITHUB_PATH`: The path to the Jekyll posts directory.

### Deploying this container using Docker

```bash
docker run --rm -it -e NOTION_TOKEN=<token> -e NOTION_USER=<user> -e GITHUB_TOKEN=<token> -e GITHUB_OWNER=<owner> -e GITHUB_REPO=<repo> -e GITHUB_PATH=<path> lpsouza/jekyll-notion-sync
```

### Deploying this container on kubernetes cronjob

```bash
kubectl create -f <(cat <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: jekyll-notion-sync
  namespace: default
spec:
    schedule: "*/5 * * * *"
    jobTemplate:
      spec:
        template:
          spec:
            restartPolicy: Never
            containers:
            - name: jekyll-notion-sync
              image: lpsouza/jekyll-notion-sync
              env:
                - name: NOTION_TOKEN
                  value: <token>
                - name: NOTION_USER
                  value: <user>
                - name: GITHUB_TOKEN
                  value: <token>
                - name: GITHUB_OWNER
                  value: <owner>
                - name: GITHUB_REPO
                  value: <repo>
                - name: GITHUB_PATH
                  value: <path>
EOF
)
```
