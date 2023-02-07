## Indexer Health Check

This is a simple health check to ensure that the indexer is running and indexing blocks. If the indexer is not running, the health check will fail.

It checks for the response time, and number of blocks behind.

## Environment Variables

The following environment variables are used by the health check script:
- SUBGRAPH_DEPL: The name of the subgraph to check
- INDEXER_SERVICE_URL: The URL of the indexer service. E.g. http://localhost:80
- POLL_INTERVAL: The interval in seconds between health checks. E.g. 60
- RPC_URL: The URL of a reference JSON-RPC endpoint. E.g. http://localhost:8545
- BLOCKS_BEHIND_THRESHOLD: The number of blocks behind the indexer can be before the health check fails. E.g. 100
- RESPONSE_TIME_THRESHOLD: The maximum response time of the indexer in milliseconds before the health check fails. E.g. 1000
- BEARER_TOKEN: The bearer token to use for authentication. E.g. 1234567890

## Usage

The health check can be run with the following command:

    npm start

